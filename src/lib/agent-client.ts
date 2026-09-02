import { agentResponseSchema, type AgentResponse } from "@/lib/agent-types";

export type AgentRequest = {
  input: string;
  timezone: string;
};

export class AgentClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AgentClientError";
  }
}

function getAgentErrorMessage(status: number) {
  if (status === 400) {
    return "MailPoint needs a message before it can help.";
  }

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 429 || status === 503) {
    return "MailPoint AI is temporarily unavailable. Please try again later.";
  }

  return "MailPoint couldn't process that request. Please try again.";
}

export async function postAgentRequest(
  input: string,
  timezone: string,
): Promise<AgentResponse> {
  let response: Response;

  try {
    response = await fetch("/api/agent", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input,
        timezone,
      } satisfies AgentRequest),
    });
  } catch {
    throw new AgentClientError(
      "MailPoint couldn't reach the AI workspace. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new AgentClientError(
      getAgentErrorMessage(response.status),
      response.status,
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new AgentClientError(
      "MailPoint received an unreadable response. Please try again.",
      response.status,
    );
  }

  const parsed = agentResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new AgentClientError(
      "MailPoint received an unexpected response. Please try again.",
      response.status,
    );
  }

  return parsed.data;
}
