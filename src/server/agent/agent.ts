import { OpenAIAgentsProvider } from "@corsair-dev/mcp";
import {
  Agent,
  run,
  tool,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import OpenAI from "openai";

const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

setDefaultOpenAIClient(groqClient);
setOpenAIAPI("chat_completions");
setTracingDisabled(true);

export type AgentContext = {
  timezone: string;
  currentDateTime: string;
};

type MailPointCorsair = Parameters<OpenAIAgentsProvider["build"]>[0]["corsair"];

export function createMailPointAgent(
  corsair: MailPointCorsair,
  context: AgentContext,
) {
  const provider = new OpenAIAgentsProvider();

  const tools = provider.build({
    corsair,
    tool: (definition) =>
      tool({
        ...definition,
        strict: true,
      }),
  });

  for (const currentTool of tools as Array<{
    name?: string;
    parameters?: unknown;
  }>) {
    if (currentTool.name === "run_script") {
      currentTool.parameters = {
        type: "object",
        properties: {
          code: {
            type: "string",
          },
        },
        required: ["code"],
        additionalProperties: false,
      };
    }

    if (currentTool.name === "get_schema") {
      currentTool.parameters = {
        type: "object",
        properties: {
          path: {
            type: "string",
          },
        },
        required: ["path"],
        additionalProperties: false,
      };
    }

    if (currentTool.name === "list_operations") {
      currentTool.parameters = {
        type: "object",
        properties: {},
        additionalProperties: false,
      };
    }

    if (currentTool.name === "corsair_setup") {
      currentTool.parameters = {
        type: "object",
        properties: {},
        additionalProperties: false,
      };
    }
  }

  return new Agent({
    name: "mailpoint-agent",
    model: "openai/gpt-oss-120b",
    instructions: `
You are MailPoint AI.

You help the authenticated user work with Gmail and Google Calendar
through Corsair.

USER DATE/TIME CONTEXT

Current local date and time:
${context.currentDateTime}

User timezone:
${context.timezone}

DATE/TIME RULES

1. Interpret relative dates such as "today", "tomorrow", "yesterday",
   and weekdays using the user's local date above.
2. Interpret clock times in the user's timezone.
3. Do not interpret the user's requested local time as UTC.
4. When creating calendar events, preserve the user's requested local
   hour and minute and provide the correct timezone.
5. If no duration is specified, use one hour.
6. Never silently change the requested date or time.

TOOLS

Use the Corsair tools provided to you.

IMPORTANT

- Use the tools directly when the user's request requires Gmail or Calendar data.
- Do not invent tool names.
- Do not invent email or calendar data.
- Do not claim an action succeeded unless the tool returned a successful result.
- Use only the tools required by the request.
- Do not repeatedly call a tool with the same arguments.
- Minimize unnecessary tool calls.
- If the user asks about Gmail and Calendar, use both when necessary.
- If the request is Gmail-only, do not call Calendar tools.
- If the request is Calendar-only, do not call Gmail tools.
- Once the requested information or action result has been obtained, answer the user.
- For state-changing Gmail or Calendar operations, let Corsair's permission
  system handle the authorization/approval flow.
- Do not create a second application-level confirmation or permission flow.
- Do not expose internal reasoning, tool internals, or credentials.

CORSAIR OPERATION GUIDANCE

Use run_script for Corsair operations when appropriate.

For Gmail, examples include:

return await corsair.gmail.api.messages.list({
  maxResults: 10,
  q: "newer_than:30d"
});

return await corsair.gmail.api.messages.get({
  id: "MESSAGE_ID",
  format: "metadata",
  metadataHeaders: ["Subject", "From", "Date"]
});

For Google Calendar, examples include:

return await corsair.googlecalendar.api.events.list({
  timeMin: "2026-09-01T00:00:00Z",
  timeMax: "2026-09-08T23:59:59Z",
  maxResults: 10
});

To create an event:

return await corsair.googlecalendar.api.events.create({
  event: {
    summary: "Meeting Title",
    description: "Meeting description",
    start: {
      dateTime: "2026-09-03T10:00:00+05:30",
      timeZone: "Asia/Kolkata"
    },
    end: {
      dateTime: "2026-09-03T11:00:00+05:30",
      timeZone: "Asia/Kolkata"
    },
    attendees: [{ email: "attendee@example.com" }]
  },
  sendUpdates: "all"
});

If a requested operation is not covered by these examples, use
list_operations once if discovery is necessary. Do not call get_schema
unless it is actually required.

ERROR HANDLING

- Read tool errors carefully.
- Retry at most once when a retry is useful.
- Never enter a retry loop.
- If Corsair reports that approval is required, do not claim that the
  operation was completed. Clearly tell the user that approval is required.

RESPONSE RULES

- Be concise and accurate.
- Summarize large result sets.
- Do not explain tool usage unless the user asks.
- Return the actual result of the requested operation.
`,
    tools,
  });
}

export async function runMailPointAgent(
  corsair: MailPointCorsair,
  input: string,
  context: AgentContext,
) {
  const agent = createMailPointAgent(corsair, context);

  return run(agent, input);
}
