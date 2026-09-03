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
  history?: { role: "user" | "assistant"; content: string }[];
};

export type AgentRunResult = {
  finalOutput: string;
  proposal?: CalendarEventProposal;
};

import { calculateAvailability } from "@/server/lib/calendar-availability";

type MailPointCorsair = Record<string, unknown>;

function parseContactHeader(headerValue: string, map: Map<string, string>) {
  const parts = headerValue.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    const match = /(.*?)(?:<([^>]+)>|$)/.exec(trimmed);
    if (match) {
      const email = (
        match[2] ?? (match[1]?.includes("@") ? match[1] : "")
      )
        .trim()
        .toLowerCase();
      const rawMatch = match[1]?.trim().replace(/^["']|["']$/g, "");
      const rawName = match[2] && rawMatch ? rawMatch : "";
      const name = rawName !== "" ? rawName : email;
      if (email?.includes("@")) {
        map.set(email, name);
      }
    }
  }
}

async function executeFindContact(
  corsair: MailPointCorsair,
  query: string,
): Promise<string> {
  try {
    const tenant = corsair as Record<string, unknown>;
    const contactsMap = new Map<string, string>();
    const qLower = query.toLowerCase().trim();

    // 1. Check local DB messages cache
    try {
      const gmail = tenant.gmail as
        | {
            db?: {
              messages?: {
                search?: (args: unknown) => Promise<
                  Array<{
                    data?: { to?: string; from?: string; subject?: string };
                  }>
                >;
                list?: (args: unknown) => Promise<
                  Array<{
                    data?: { to?: string; from?: string; subject?: string };
                  }>
                >;
              };
            };
          }
        | undefined;

      if (gmail?.db?.messages?.search) {
        const cached = await gmail.db.messages.search({
          data: { to: { contains: qLower } },
          limit: 15,
        });
        for (const item of cached) {
          if (item.data?.to) parseContactHeader(item.data.to, contactsMap);
          if (item.data?.from) parseContactHeader(item.data.from, contactsMap);
        }
      }
    } catch {
      // ignore
    }

    // 2. Check local DB events cache
    try {
      const gcal = tenant.googlecalendar as
        | {
            db?: {
              events?: {
                search?: (args: unknown) => Promise<
                  Array<{
                    data?: {
                      summary?: string;
                      attendees?: Array<{
                        email?: string;
                        displayName?: string;
                        self?: boolean;
                      }>;
                    };
                  }>
                >;
                list?: (args: unknown) => Promise<
                  Array<{
                    data?: {
                      summary?: string;
                      attendees?: Array<{
                        email?: string;
                        displayName?: string;
                        self?: boolean;
                      }>;
                    };
                  }>
                >;
              };
            };
          }
        | undefined;

      if (gcal?.db?.events) {
        const events = gcal.db.events.search
          ? await gcal.db.events.search({
              data: { summary: { contains: qLower } },
              limit: 15,
            })
          : gcal.db.events.list
            ? await gcal.db.events.list({ limit: 15 })
            : [];

        for (const ev of events) {
          for (const att of ev.data?.attendees ?? []) {
            if (att.email && !att.self) {
              contactsMap.set(
                att.email.toLowerCase(),
                att.displayName ?? att.email,
              );
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Fallback to live Gmail API if not found yet
    if (contactsMap.size === 0) {
      try {
        const gmail = tenant.gmail as
          | {
              api?: {
                messages?: {
                  list: (args: unknown) => Promise<{
                    messages?: Array<{ id?: string }>;
                  }>;
                  get: (args: unknown) => Promise<{
                    payload?: {
                      headers?: Array<{ name?: string; value?: string }>;
                    };
                  }>;
                };
              };
            }
          | undefined;

        if (gmail?.api?.messages) {
          const listRes = await gmail.api.messages.list({
            q: query,
            maxResults: 5,
          });

          for (const m of listRes.messages ?? []) {
            if (!m.id) continue;
            const full = await gmail.api.messages.get({
              id: m.id,
              format: "full",
            });
            for (const h of full.payload?.headers ?? []) {
              const nameLower = h.name?.toLowerCase();
              if (nameLower === "to" || nameLower === "from") {
                parseContactHeader(h.value ?? "", contactsMap);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const matchedContacts: Array<{ email: string; displayName: string }> = [];
    for (const [email, name] of contactsMap.entries()) {
      if (name.toLowerCase().includes(qLower) || email.toLowerCase().includes(qLower)) {
        matchedContacts.push({ email, displayName: name });
      }
    }

    if (matchedContacts.length > 0) {
      return JSON.stringify({
        found: true,
        contacts: matchedContacts,
      });
    }

    return JSON.stringify({
      found: false,
      message: `No existing contact or email address found matching "${query}". Please ask the user for the attendee's email address.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ found: false, error: message });
  }
}

async function executeCheckAvailability(
  corsair: MailPointCorsair,
  args: {
    startTime: string;
    endTime: string;
    attendeeEmails?: string[];
    durationMinutes?: number;
  },
  context: AgentContext,
): Promise<string> {
  try {
    const tenant = corsair as {
      googlecalendar?: {
        api?: {
          calendar?: {
            getAvailability: (params: {
              timeMin: string;
              timeMax: string;
              timeZone?: string;
              items?: Array<{ id: string }>;
            }) => Promise<unknown>;
          };
        };
      };
    };

    if (!tenant.googlecalendar?.api?.calendar?.getAvailability) {
      return JSON.stringify({
        isAvailable: true,
        warning: "Google Calendar availability check is unavailable.",
      });
    }

    const reqStart = new Date(args.startTime);
    const reqEnd = new Date(args.endTime);

    if (Number.isNaN(reqStart.getTime()) || Number.isNaN(reqEnd.getTime())) {
      return JSON.stringify({
        isAvailable: false,
        error: "Invalid startTime or endTime format. ISO 8601 string expected.",
      });
    }

    const durationMinutes =
      args.durationMinutes && args.durationMinutes > 0
        ? args.durationMinutes
        : Math.max(
            15,
            Math.round((reqEnd.getTime() - reqStart.getTime()) / (60 * 1000)),
          );

    // Compute surrounding check window for the day to discover alternatives
    const dayStart = new Date(reqStart);
    dayStart.setHours(8, 0, 0, 0);
    const windowStart = new Date(
      Math.min(dayStart.getTime(), reqStart.getTime()),
    ).toISOString();

    const dayEnd = new Date(reqStart);
    dayEnd.setHours(19, 0, 0, 0);
    const windowEnd = new Date(
      Math.max(dayEnd.getTime(), reqEnd.getTime()),
    ).toISOString();

    const calendarIds = [
      "primary",
      ...(args.attendeeEmails ?? []).filter(
        (email) => typeof email === "string" && email.includes("@"),
      ),
    ];

    const rawResponse =
      await tenant.googlecalendar.api.calendar.getAvailability({
        timeMin: windowStart,
        timeMax: windowEnd,
        timeZone: context.timezone,
        items: calendarIds.map((id) => ({ id })),
      });

    const availResult = calculateAvailability({
      response: rawResponse,
      calendarIds,
      timeMin: windowStart,
      timeMax: windowEnd,
      durationMinutes,
    });

    const reqStartMs = reqStart.getTime();
    const reqEndMs = reqEnd.getTime();

    // Check if requested time interval overlaps any busy interval
    const conflicts: Array<{ calendar: string; start: string; end: string }> = [];
    for (const cal of availResult.calendars) {
      for (const b of cal.busy) {
        const bStartMs = new Date(b.start).getTime();
        const bEndMs = new Date(b.end).getTime();
        if (bStartMs < reqEndMs && bEndMs > reqStartMs) {
          conflicts.push({
            calendar: cal.id,
            start: b.start,
            end: b.end,
          });
        }
      }
    }

    const isAvailable = conflicts.length === 0;

    // Filter alternative slots to those not overlapping the requested conflict
    const alternatives = availResult.slots
      .filter((slot) => {
        const slotStartMs = new Date(slot.start).getTime();
        const slotEndMs = new Date(slot.end).getTime();
        return !(slotStartMs < reqEndMs && slotEndMs > reqStartMs);
      })
      .slice(0, 4);

    return JSON.stringify({
      isAvailable,
      requestedTime: {
        start: args.startTime,
        end: args.endTime,
        durationMinutes,
      },
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      suggestedAlternatives: alternatives.length > 0 ? alternatives : undefined,
      attendeeAvailability: availResult.attendeeAvailability,
      warnings: availResult.warnings.length > 0 ? availResult.warnings : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({
      isAvailable: false,
      error: `Failed to check calendar availability: ${message}`,
    });
  }
}

const agentTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_calendar_availability",
      description:
        "Check the authenticated user's actual Google Calendar availability for a requested date and time window using the Calendar integration. Also checks attendee availability and returns alternative available slots if there is a conflict. You MUST ALWAYS call this before proposing any calendar event.",
      parameters: {
        type: "object",
        properties: {
          startTime: {
            type: "string",
            description:
              "Start time in ISO 8601 format with timezone offset (e.g. 2026-09-13T08:00:00+05:30)",
          },
          endTime: {
            type: "string",
            description:
              "End time in ISO 8601 format with timezone offset (e.g. 2026-09-13T09:00:00+05:30)",
          },
          attendeeEmails: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional list of attendee email addresses to check mutual availability",
          },
          durationMinutes: {
            type: "number",
            description:
              "Duration of the meeting in minutes. Defaults to 60 if not specified.",
          },
        },
        required: ["startTime", "endTime"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_contact",
      description:
        "Search Gmail messages and past events to find the verified email address and display name for a contact name (e.g. 'Piyush'). Use this whenever the user specifies a person by name without an email address.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The name or keyword of the contact to search for (e.g. 'Piyush')",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_calendar_event",
      description:
        "Propose creating a new Google Calendar event for inline user confirmation. ONLY call this after check_calendar_availability has confirmed the slot is available. Never propose a conflicting event.",
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
            description: "List of attendee emails and display names",
          },
        },
        required: ["summary", "start", "end"],
        additionalProperties: false,
      },
    },
  },
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
];

function prepareSnippet(code: string): string {
  let trimmed = code.trim();

  // If the snippet starts with an async arrow function without invocation:
  // e.g. "async () => { ... }" -> "(async () => { ... })()"
  if (/^async\s*\([^)]*\)\s*=>/.test(trimmed)) {
    trimmed = `(${trimmed})()`;
  } else if (/^async\s+function\s*([a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/.test(trimmed)) {
    const match = /^async\s+function\s*([a-zA-Z0-9_$]+)/.exec(trimmed);
    if (match?.[1]) {
      const fnName = match[1];
      if (!trimmed.endsWith(`${fnName}()`) && !trimmed.endsWith(`${fnName}();`)) {
        trimmed = `${trimmed}\nreturn await ${fnName}();`;
      }
    }
  }

  // If it ends with a function call like `fetchEmails();` or `getMsgs()`, ensure it's awaited and returned:
  if (/;\s*([a-zA-Z0-9_$]+)\s*\(\s*\)\s*;?$/.test(trimmed)) {
    trimmed = trimmed.replace(/;\s*([a-zA-Z0-9_$]+)\s*\(\s*\)\s*;?$/, "; return await $1();");
  }

  // If it's an IIFE like `(async () => { ... })()` without return:
  if (/^\(?\s*async\b.*?\)\s*\(\s*\)\s*;?$/s.test(trimmed) && !trimmed.startsWith("return")) {
    trimmed = `return await ${trimmed.replace(/^return\s+await\s+/, "")}`;
  }

  // If there's no return at all in a single expression:
  if (!trimmed.includes("return") && !trimmed.startsWith("const ") && !trimmed.startsWith("let ") && !trimmed.startsWith("var ")) {
    trimmed = `return await (${trimmed})`;
  }

  return trimmed;
}

async function executeRunScript(
  corsair: MailPointCorsair,
  code: string,
): Promise<string> {
  try {
    const cleanCode = prepareSnippet(code);

    // Provide aliases so model variations (e.g. corsair.calendar vs corsair.googlecalendar) never fail
    const cObj = corsair as Record<string, unknown>;
    if (cObj.googlecalendar && !cObj.calendar) {
      cObj.calendar = cObj.googlecalendar;
    }
    const calObj = (cObj.calendar ?? cObj.googlecalendar) as Record<string, unknown> | undefined;
    if (calObj?.api && typeof calObj.api === "object") {
      const calApi = calObj.api as Record<string, unknown>;
      if (calApi.events && typeof calApi.events === "object") {
        const ev = calApi.events as Record<string, unknown>;
        if (typeof ev.getMany === "function" && !ev.list) {
          ev.list = ev.getMany;
        }
      }
      if (calApi.events && !calObj.events) {
        calObj.events = calApi.events;
      }
    }
    const gmailPlugin = cObj.gmail as Record<string, unknown> | undefined;
    if (gmailPlugin?.api && typeof gmailPlugin.api === "object") {
      const gmailApi = gmailPlugin.api as Record<string, unknown>;
      if (gmailApi.messages && !gmailPlugin.messages) {
        gmailPlugin.messages = gmailApi.messages;
      }
      if (gmailApi.threads && !gmailPlugin.threads) {
        gmailPlugin.threads = gmailApi.threads;
      }
    }

    const messagesApi = (gmailPlugin?.api as Record<string, unknown> | undefined)?.messages as Record<string, unknown> | undefined;
    if (messagesApi && typeof messagesApi.get === "function" && !messagesApi._patched) {
      messagesApi._patched = true;
      const origGet = messagesApi.get.bind(messagesApi) as (args: Record<string, unknown>) => Promise<unknown>;
      messagesApi.get = async (args: Record<string, unknown>) => {
        if (args?.format === "metadata" && args.metadataHeaders) {
          const rest = { ...args };
          delete rest.metadataHeaders;
          return origGet(rest);
        }
        return origGet(args);
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      "corsair",
      "corsour",
      `return (async () => { ${cleanCode} })()`,
    ) as (ctx: MailPointCorsair, ctxAlias: MailPointCorsair) => Promise<unknown>;

    const rawResult = await fn(corsair, corsair);

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
  const systemPrompt = `You are MailPoint AI, an intelligent assistant helping the authenticated user manage Gmail and Google Calendar via Corsair.

USER CONTEXT:
- Local Date & Time: ${context.currentDateTime}
- User Timezone: ${context.timezone}

CRITICAL RULES:
1. Date Interpretation:
   - Interpret relative dates (today, tomorrow, next Monday, 13 September, etc.) using the user's local date and timezone above.
   - For all start and end timestamps, include the full ISO 8601 string with the local timezone offset (e.g. 2026-09-13T08:00:00+05:30).

2. Attendee & Contact Resolution:
   - When a user asks to schedule a meeting with a person by name (e.g. "Schedule a meeting with Piyush"), look up their email address using the find_contact tool.
   - If find_contact returns matching contacts, select the appropriate contact email and include it with displayName in the attendees list.
   - If no contact is found or the name is ambiguous, explicitly inform the user and ask for their email address. NEVER create or propose a meeting with a fake or omitted attendee email when an attendee was requested.

3. Calendar Scheduling Workflow:
   - Determine date, start/end time, attendee(s), and meeting title/summary. Default duration is 60 minutes if unspecified.
   - MANDATORY AVAILABILITY CHECK: You MUST ALWAYS call check_calendar_availability for the requested date and time BEFORE proposing any calendar event. Do NOT infer availability from memory or assume the slot is free.
   - IF THE REQUESTED TIME HAS A CONFLICT (isAvailable = false):
     * DO NOT call propose_calendar_event. Under no circumstances should a conflicting event be proposed or scheduled.
     * Clearly tell the user that the requested time conflicts with an existing event on their calendar.
     * State the available alternative times returned by check_calendar_availability and ask the user if they would like to reschedule to one of those times.
   - IF THE REQUESTED TIME IS AVAILABLE (isAvailable = true):
     * Call propose_calendar_event with summary, start (ISO with offset), end (ISO with offset), and attendees (with email and displayName).
     * After calling propose_calendar_event, tell the user: "Please review the event details in the card below and click **Confirm this** to schedule it on your calendar."
     * NEVER tell the user to type "confirm" or "confirm this" in the chat. The button in the card is the only confirmation mechanism.

4. Reading Gmail or Calendar:
   - For listing emails:
     const list = await corsair.gmail.api.messages.list({ maxResults: 5, labelIds: ['INBOX'] });
     const msgs = await Promise.all((list.messages || []).map(m => corsair.gmail.api.messages.get({ id: m.id, format: 'metadata' })));
     return msgs.map(m => {
       const headers = m.payload?.headers || [];
       const getH = (name) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
       return { id: m.id, from: getH('From'), subject: getH('Subject'), date: getH('Date'), snippet: m.snippet };
     });
   - For listing calendar events:
     const list = await corsair.googlecalendar.api.events.getMany({ calendarId: 'primary', timeMin: '...', timeMax: '...', singleEvents: true });
     return (list.items || []).map(e => ({ summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date }));
   - ALWAYS return the data using a top-level return statement.
   - In your final response to the user, present the summarized information cleanly.

5. Communication Style:
   - Return clear, helpful, professional responses. Do not mention internal tool names in user-facing prose.`;

  // Build messages: system + prior conversation history (max 10 turns) + current user message
  const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = (
    context.history ?? []
  ).slice(-10).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: input },
  ];

  let proposal: CalendarEventProposal | undefined;
  let finalOutput = "";
  const maxTurns = 6;

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

        if (fnName === "check_calendar_availability") {
          const startTime =
            typeof args.startTime === "string" ? args.startTime : "";
          const endTime =
            typeof args.endTime === "string" ? args.endTime : "";

          const availResult = await executeCheckAvailability(
            corsair,
            {
              startTime,
              endTime,
              attendeeEmails: Array.isArray(args.attendeeEmails)
                ? (args.attendeeEmails as string[])
                : undefined,
              durationMinutes:
                typeof args.durationMinutes === "number"
                  ? args.durationMinutes
                  : undefined,
            },
            context,
          );
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: availResult,
          });
        } else if (fnName === "find_contact") {
          const query = typeof args.query === "string" ? args.query : "";
          const contactResult = await executeFindContact(corsair, query);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: contactResult,
          });
        } else if (fnName === "propose_calendar_event") {
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
