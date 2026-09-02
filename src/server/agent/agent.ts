import OpenAI from "openai";
import type { CalendarEventProposal } from "@/lib/agent-types";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is missing.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}


export type AgentContext = {
  timezone: string;
  currentDateTime: string;
};

export type AgentRunResult = {
  finalOutput: string;
  proposal?: CalendarEventProposal;
};

type MailPointCorsair = Record<string, unknown>;

const agentTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "run_script",
      description:
        "Execute an async JavaScript snippet with `corsair` in scope to read Gmail messages/threads or Google Calendar events. Return only needed data.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "JavaScript async snippet with `corsair` in scope. Return the data needed. Example: return await corsair.gmail.api.messages.list({ maxResults: 5 });",
          },
        },
        required: ["code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_calendar_event",
      description:
        "Propose creating a new Google Calendar event for inline user confirmation. Always use this instead of creating events directly.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Title/summary of the calendar event",
          },
          description: {
            type: "string",
            description: "Optional description or agenda",
          },
          location: {
            type: "string",
            description: "Optional location",
          },
          start: {
            type: "object",
            properties: {
              dateTime: {
                type: "string",
                description:
                  "ISO 8601 start date-time with timezone offset (e.g. 2026-09-03T10:00:00+05:30)",
              },
              timeZone: {
                type: "string",
                description: "Timezone name",
              },
            },
            required: ["dateTime"],
            additionalProperties: false,
          },
          end: {
            type: "object",
            properties: {
              dateTime: {
                type: "string",
                description:
                  "ISO 8601 end date-time with timezone offset (e.g. 2026-09-03T11:00:00+05:30)",
              },
              timeZone: {
                type: "string",
                description: "Timezone name",
              },
            },
            required: ["dateTime"],
            additionalProperties: false,
          },
          attendees: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email: { type: "string" },
                displayName: { type: "string" },
              },
              required: ["email"],
              additionalProperties: false,
            },
            description: "Optional list of attendee emails",
          },
        },
        required: ["summary", "start", "end"],
        additionalProperties: false,
      },
    },
  },
];

async function executeRunScript(
  corsair: MailPointCorsair,
  code: string,
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      "corsair",
      `return (async () => { ${code} })()`,
    ) as (ctx: MailPointCorsair) => Promise<unknown>;

    const rawResult = await fn(corsair);

    if (rawResult === undefined || rawResult === null) {
      return "null";
    }

    let jsonStr = JSON.stringify(rawResult);

    // Context protection: limit tool response size
    if (jsonStr.length > 2500) {
      if (Array.isArray(rawResult)) {
        jsonStr = JSON.stringify(rawResult.slice(0, 5));
      } else if (rawResult && typeof rawResult === "object") {
        const record = rawResult as Record<string, unknown>;
        const obj: Record<string, unknown> = { ...record };
        if (Array.isArray(record.messages)) obj.messages = record.messages.slice(0, 5);
        if (Array.isArray(record.items)) obj.items = record.items.slice(0, 5);
        if (Array.isArray(record.threads)) obj.threads = record.threads.slice(0, 5);
        jsonStr = JSON.stringify(obj);
      }

      if (jsonStr.length > 2500) {
        jsonStr = jsonStr.slice(0, 2500) + "... [truncated to save context]";
      }
    }

    return jsonStr;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error executing snippet: ${message}`;
  }
}

export async function runMailPointAgent(
  corsair: MailPointCorsair,
  input: string,
  context: AgentContext,
): Promise<AgentRunResult> {
  const systemPrompt = `You are MailPoint AI, helping the authenticated user work with Gmail and Google Calendar through Corsair.

USER CONTEXT:
- Local Date & Time: ${context.currentDateTime}
- User Timezone: ${context.timezone}

RULES:
1. Interpret relative dates (today, tomorrow, weekdays) using the local date above.
2. For Gmail requests (e.g. "show latest 5 emails"):
   - Use run_script to query corsair.gmail.api.messages.list({ maxResults: 5 }) or get metadata.
   - Summarize the retrieved emails clearly (Subject, From, Date, Snippet). Never hallucinate email data.
3. For Calendar read requests (e.g. "what are my next 5 events"):
   - Use run_script to query corsair.googlecalendar.api.events.list({ timeMin: new Date().toISOString(), maxResults: 5 }) or similar.
   - Summarize the retrieved events clearly. Never hallucinate calendar data.
4. For Calendar write/create requests (e.g. "Create a meeting tomorrow at 10 AM called Project Review"):
   - Do NOT call events.create in run_script.
   - ALWAYS call propose_calendar_event with summary, start (ISO with offset), end (ISO with offset).
   - If no duration is given, default to 1 hour.
   - Clearly inform the user that the event proposal is ready for their confirmation.
5. Return concise, helpful responses. Do not reveal tool internals unless asked.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: input },
  ];

  let proposal: CalendarEventProposal | undefined;
  let finalOutput = "";
  const maxTurns = 5;

  const groq = getGroqClient();

  for (let turn = 0; turn < maxTurns; turn++) {
    const approxTokens = Math.ceil(JSON.stringify(messages).length / 4);
    console.log(
      `[MailPoint AI] Turn ${turn + 1}/${maxTurns}: ~${approxTokens} tokens (${messages.length} messages)`,
    );

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages,
        tools: agentTools,
        temperature: 0.1,
        max_completion_tokens: 1024,
      });

    } catch (err: unknown) {
      console.error("[MailPoint AI Groq Error]", err);
      const errObj = err as { status?: number; message?: string };
      if (errObj?.status === 413 || errObj?.message?.includes("Request too large")) {
        throw new Error(
          "Request size limit reached. Please try a simpler request.",
        );
      }
      throw err;
    }

    const choice = completion.choices?.[0];
    if (!choice?.message) {
      break;
    }

    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    if (assistantMsg.content) {
      finalOutput = assistantMsg.content;
    }

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      for (const toolCall of assistantMsg.tool_calls) {
        if (toolCall.type !== "function") continue;
        const fnName = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }

        if (fnName === "propose_calendar_event") {
          proposal = args as unknown as CalendarEventProposal;
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: "proposal_recorded",
              message:
                "The proposal has been saved. Please inform the user with a clean summary of the proposed event.",
              proposal,
            }),
          });
        } else if (fnName === "run_script") {
          const codeSnippet = typeof args.code === "string" ? args.code : "";
          const result = await executeRunScript(corsair, codeSnippet);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      }
    } else {
      // Model responded without further tool calls
      break;
    }
  }

  return {
    finalOutput:
      finalOutput ||
      (proposal
        ? `I have prepared the calendar event "${proposal.summary}". Please confirm to add it to your Google Calendar.`
        : "I have processed your request."),
    proposal,
  };
}
