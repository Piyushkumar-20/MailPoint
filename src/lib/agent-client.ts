import {
  agentResponseSchema,
  confirmResponseSchema,
  type AgentResponse,
  type ConfirmResponse,
} from "@/lib/agent-types";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentRequest = {
  input: string;
  timezone: string;
  history?: ChatHistoryMessage[];
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

async function getAgentErrorMessage(response: Response) {
  let data: unknown;

  try {
    data = await response.clone().json();
  } catch {
    data = undefined;
  }

  if (data && typeof data === "object") {
    const errorData = data as { code?: unknown; error?: unknown };
    if (
      errorData.code === "AI_DAILY_LIMIT_EXCEEDED" &&
      typeof errorData.error === "string"
    ) {
      return errorData.error;
    }
  }

  return getGenericAgentErrorMessage(response.status);
}

function getGenericAgentErrorMessage(status: number) {
  if (status === 400) {
    return "MailPoint needs a valid message before it can help.";
  }

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 413) {
    return "Request size limit exceeded. Please try a simpler or shorter request.";
  }

  if (status === 429) {
    return "MailPoint AI request limit reached. Please try again tomorrow or upgrade to Pro.";
  }

  if (status === 503) {
    return "MailPoint AI is temporarily unavailable. Please try again later.";
  }

  return "MailPoint couldn't process that request. Please try again.";
}

export async function postAgentRequest(
  input: string,
  timezone: string,
  history?: ChatHistoryMessage[],
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
        history,
      } satisfies AgentRequest),
    });
  } catch {
    throw new AgentClientError(
      "MailPoint couldn't reach the AI workspace. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new AgentClientError(
      await getAgentErrorMessage(response),
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

export async function postConfirmation(
  token: string,
  action: "confirm" | "cancel",
): Promise<ConfirmResponse> {
  let response: Response;

  try {
    response = await fetch("/api/agent/confirm", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        action,
      }),
    });
  } catch {
    throw new AgentClientError(
      "MailPoint couldn't reach the confirmation service. Check your connection and try again.",
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

  const parsed = confirmResponseSchema.safeParse(data);

  if (!parsed.success) {
    if (data && typeof data === "object") {
      const errObj = data as { message?: unknown; error?: unknown };
      if (!response.ok && typeof errObj.message === "string") {
        throw new AgentClientError(errObj.message, response.status);
      }
      if (!response.ok && typeof errObj.error === "string") {
        throw new AgentClientError(errObj.error, response.status);
      }
    }
    throw new AgentClientError(
      "MailPoint received an unexpected confirmation response. Please try again.",
      response.status,
    );
  }

  return parsed.data;
}
