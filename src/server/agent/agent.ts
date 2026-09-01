import Groq from "groq-sdk";
import {
  buildCorsairToolDefs,
  type CorsairToolDef,
} from "@corsair-dev/mcp";
import { z } from "zod";

import {
  calendarActionProposalSchema,
  type CalendarActionProposal,
} from "@/lib/agent-types";

const MODEL = "openai/gpt-oss-120b";
const MAX_ITERATIONS = 4;

type MailPointCorsair = Parameters<
  typeof buildCorsairToolDefs
>[0]["corsair"];

type GroqToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type GroqMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: GroqToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      name: string;
      content: string;
    };

export type AgentContext = {
  timezone: string;
  currentDateTime: string;
};

export type AgentRunResult = {
  finalOutput: string;
  calendarActionProposal?: CalendarActionProposal;
};

type MailPointTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
};

const toolArgumentsSchema = z.record(z.string(), z.unknown());

type CorsairHandlerResult = Awaited<
  ReturnType<CorsairToolDef["handler"]>
>;
type CorsairContentItem = CorsairHandlerResult["content"][number];
type CorsairTextContentItem = Extract<
  CorsairContentItem,
  { type: "text" }
>;

function isCorsairTextContentItem(
  item: CorsairContentItem,
): item is CorsairTextContentItem {
  return item.type === "text";
}

function getTextFromCorsairResult(
  result: CorsairHandlerResult,
): string {
  return result.content
    .filter(isCorsairTextContentItem)
    .map((item) => item.text)
    .join("\n");
}

function createRunScriptExecutor(corsair: MailPointCorsair) {
  const definitions = buildCorsairToolDefs({ corsair });
  const runScriptDefinition = definitions.find(
    (definition) => definition.name === "run_script",
  );

  if (!runScriptDefinition) {
    throw new Error("Corsair run_script tool is unavailable.");
  }

  return async (code: string): Promise<string> => {
    const result = await runScriptDefinition.handler({ code });
    const text = getTextFromCorsairResult(result);

    if (result.isError) {
      throw new Error(text || "Corsair run_script failed.");
    }

    return text;
  };
}

function createMailPointTools(corsair: MailPointCorsair): MailPointTool[] {
  const runScript = createRunScriptExecutor(corsair);

  return [
    {
      name: "propose_calendar_event",
      description:
        "Prepare a Google Calendar event for the user to review. This tool NEVER creates, updates, or sends a calendar invitation. Use it when the user asks MailPoint to schedule or create a meeting. The server will return the proposal for explicit user confirmation.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title." },
          start: {
            type: "string",
            description:
              "Event start as an ISO 8601 date/time with timezone offset.",
          },
          end: {
            type: "string",
            description:
              "Event end as an ISO 8601 date/time with timezone offset.",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "Attendee email addresses.",
          },
        },
        required: ["summary", "start", "end", "attendees"],
        additionalProperties: false,
      },
      execute: async (args) => {
        const summary =
          typeof args.summary === "string" ? args.summary.trim() : "";
        const start =
          typeof args.start === "string" ? args.start.trim() : "";
        const end =
          typeof args.end === "string" ? args.end.trim() : "";
        const attendees = Array.isArray(args.attendees)
          ? args.attendees
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0,
              )
              .map((value) => value.trim())
          : [];

        if (!summary || !start || !end) {
          throw new Error(
            "Calendar proposal requires a summary, start time, and end time.",
          );
        }

        const proposal: CalendarActionProposal = {
          type: "calendar_event",
          summary,
          start,
          end,
          attendees,
        };

        return JSON.stringify({
          status: "confirmation_required",
          action: proposal,
        });
      },
    },
    {
      name: "search_emails",
      description:
        "Search the authenticated user's Gmail messages. Use this to find emails by subject, sender, recipient, or message content. Returns recent matching messages.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Gmail search query. Example: Testing Phase 3, from:example@gmail.com, subject:interview",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description:
              "Maximum number of messages to return. Default is 5.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      execute: async (args) => {
        const query =
          typeof args.query === "string" ? args.query.trim() : "";
        const limit =
          typeof args.limit === "number"
            ? Math.min(Math.max(Math.floor(args.limit), 1), 10)
            : 5;

        if (!query) {
          throw new Error("Email search query is required.");
        }

        const code = `
const result = await corsair.gmail.api.messages.list({
  q: ${JSON.stringify(query)},
  maxResults: ${limit}
});

return result;
`;
        return runScript(code);
      },
    },
    {
      name: "get_email",
      description:
        "Get the full details of a Gmail message using its message ID. Use this after search_emails when the user needs the actual email contents.",
      parameters: {
        type: "object",
        properties: {
          messageId: {
            type: "string",
            description: "Gmail message ID returned by search_emails.",
          },
        },
        required: ["messageId"],
        additionalProperties: false,
      },
      execute: async (args) => {
        const messageId =
          typeof args.messageId === "string"
            ? args.messageId.trim()
            : "";

        if (!messageId) {
          throw new Error("messageId is required.");
        }

        const code = `
const result = await corsair.gmail.api.messages.get({
  id: ${JSON.stringify(messageId)},
  format: "full"
});

return result;
`;
        return runScript(code);
      },
    },
    {
      name: "search_calendar_events",
      description:
        "Search the authenticated user's Google Calendar events. Use this to find events related to a subject, person, or phrase. Searches the primary calendar within a reasonable date range.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Calendar search phrase. Example: Testing Phase 3, interview, meeting with Rahul.",
          },
          timeMin: {
            type: "string",
            description:
              "Optional ISO date/time for the beginning of the search window.",
          },
          timeMax: {
            type: "string",
            description:
              "Optional ISO date/time for the end of the search window.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            description:
              "Maximum number of events to return. Default is 10.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      execute: async (args) => {
        const query =
          typeof args.query === "string" ? args.query.trim() : "";
        const limit =
          typeof args.limit === "number"
            ? Math.min(Math.max(Math.floor(args.limit), 1), 25)
            : 10;

        if (!query) {
          throw new Error("Calendar search query is required.");
        }

        const now = new Date();
        const defaultTimeMin = new Date(
          now.getTime() - 365 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const defaultTimeMax = new Date(
          now.getTime() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const timeMin =
          typeof args.timeMin === "string" && args.timeMin.trim()
            ? args.timeMin.trim()
            : defaultTimeMin;
        const timeMax =
          typeof args.timeMax === "string" && args.timeMax.trim()
            ? args.timeMax.trim()
            : defaultTimeMax;

        const code = `
const result = await corsair.googlecalendar.api.events.getMany({
  calendarId: "primary",
  timeMin: ${JSON.stringify(timeMin)},
  timeMax: ${JSON.stringify(timeMax)},
  q: ${JSON.stringify(query)},
  maxResults: ${limit}
});

return result;
`;
        return runScript(code);
      },
    },
  ];
}

function createGroqToolDefinitions(tools: MailPointTool[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function createToolExecutor(tools: MailPointTool[]) {
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

  return async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> => {
    const tool = toolMap.get(name);

    if (!tool) {
      throw new Error(`Unknown MailPoint tool: ${name}`);
    }

    return tool.execute(args);
  };
}

function parseCalendarActionProposal(
  result: string,
): CalendarActionProposal {
  const calendarProposalResultSchema = z.object({
    status: z.literal("confirmation_required"),
    action: calendarActionProposalSchema,
  });

  try {
    return calendarProposalResultSchema.parse(JSON.parse(result)).action;
  } catch {
    throw new Error("Calendar action proposal was invalid.");
  }
}

export function createMailPointAgent(
  corsair: MailPointCorsair,
  context: AgentContext,
) {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const tools = createMailPointTools(corsair);
  const groqTools = createGroqToolDefinitions(tools);
  const executeTool = createToolExecutor(tools);

  return {
    async run(input: string): Promise<AgentRunResult> {
      const messages: GroqMessage[] = [
        {
          role: "system",
          content: `
You are MailPoint AI.

You help the authenticated user work with Gmail and Google Calendar.

USER DATE/TIME CONTEXT:

Current local date and time:
${context.currentDateTime}

User timezone:
${context.timezone}

DATE/TIME RULES:

1. Interpret "today", "tomorrow", "yesterday", "next Monday",
   and similar relative dates using the user's local date above.
2. Interpret clock times such as "10 AM" and "3 PM" in the user's
   timezone above.
3. Do not interpret the user's requested local time as UTC.
4. When creating a calendar proposal, convert the requested local
   time into an ISO 8601 timestamp containing the correct timezone offset.
5. If the user says "tomorrow at 10 AM", the start time MUST be exactly
   10:00 AM tomorrow in the user's timezone.
6. If the user does not specify a duration, use a one-hour duration.
7. Never change the requested hour or minute unless the user explicitly
   asks for a different time.

AVAILABLE TOOLS:

- search_emails
- get_email
- search_calendar_events
- propose_calendar_event

IMPORTANT:

1. Use the available MailPoint tools directly.
2. Do not invent tool names.
3. Do not generate JavaScript.
4. Do not use Corsair operation paths yourself.
5. Do not perform tool discovery.
6. Do not repeatedly call the same tool with the same arguments.
7. Use real tool results. Never invent email or calendar data.
8. If the user asks about both Gmail and Calendar, use both tools when necessary.
9. If the request is Gmail-only, do not call Calendar.
10. If the request is Calendar-only, do not call Gmail.
11. After obtaining the requested information, provide the answer instead of continuing to search.
12. Gmail and Calendar search tools are read-only.
13. propose_calendar_event is non-mutating.
14. Never claim that a calendar event was created, updated, or sent unless
    an execution tool actually performs that action.

CALENDAR ACTIONS:

When the user asks to create or schedule a calendar event:

1. Understand the requested event details.
2. If the attendee email address is known, use it.
3. If required information is missing or ambiguous, ask the user for clarification.
4. Use propose_calendar_event to prepare the event.
5. Do not search Calendar unless the user asks to check availability or existing events.
6. Do not claim that the event was created.
7. Wait for explicit user confirmation before execution.

For:

"Find my latest email about Testing Phase 3 and check whether I have a
calendar event related to it."

Use this workflow:

1. search_emails("Testing Phase 3")
2. Identify the most recent relevant email.
3. If necessary, use get_email for the selected message.
4. search_calendar_events("Testing Phase 3")
5. Compare the results.
6. Answer the user.

Do not search the same information repeatedly.

Keep the final response concise and useful.
`,
        },
        {
          role: "user",
          content: input,
        },
      ];

      for (
        let iteration = 0;
        iteration < MAX_ITERATIONS;
        iteration++
      ) {
        const response = await groq.chat.completions.create({
          model: MODEL,
          messages,
          tools: groqTools,
          tool_choice: "auto",
          parallel_tool_calls: false,
          reasoning_effort: "low",
          reasoning_format: "hidden",
          temperature: 0.2,
          max_completion_tokens: 1200,
        });

        const message = response.choices[0]?.message;

        if (!message) {
          throw new Error("Groq returned no response.");
        }

        const toolCalls = message.tool_calls ?? [];

        messages.push({
          role: "assistant",
          content: message.content,
          ...(toolCalls.length > 0
            ? {
                tool_calls: toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  type: "function" as const,
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments,
                  },
                })),
              }
            : {}),
        });

        if (toolCalls.length === 0) {
          return {
            finalOutput: message.content ?? "",
          };
        }

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let parsed: unknown;

          try {
            parsed = JSON.parse(toolCall.function.arguments);
          } catch {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({
                error: "Invalid JSON arguments.",
              }),
            });
            continue;
          }

          const args = toolArgumentsSchema.safeParse(parsed);

          if (!args.success) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({
                error: "Tool arguments must be a JSON object.",
              }),
            });
            continue;
          }

          try {
            const result = await executeTool(toolName, args.data);

            if (toolName === "propose_calendar_event") {
              const proposal = parseCalendarActionProposal(result);

              return {
                finalOutput:
                  "I can prepare this calendar event for your review. Nothing has been created yet.",
                calendarActionProposal: proposal,
              };
            }

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: result,
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Tool execution failed.";

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({
                error: errorMessage,
              }),
            });
          }
        }
      }

      throw new Error(
        "MailPoint AI could not complete the request within the allowed steps.",
      );
    },
  };
}

export async function runMailPointAgent(
  corsair: MailPointCorsair,
  input: string,
  context: AgentContext,
): Promise<AgentRunResult> {
  const agent = createMailPointAgent(corsair, context);
  return agent.run(input);
}
