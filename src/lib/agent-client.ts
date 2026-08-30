export type AgentRequest = {
  input: string;
};

export type AgentResponse = {
  output: string;
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

function isAgentResponse(value: unknown): value is AgentResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "output" in value &&
    typeof value.output === "string"
  );
}

export async function postAgentRequest(input: string): Promise<AgentResponse> {
  let response: Response;

  try {
    response = await fetch("/api/agent", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input } satisfies AgentRequest),
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

  if (!isAgentResponse(data)) {
    throw new AgentClientError(
      "MailPoint received an unexpected response. Please try again.",
      response.status,
    );
  }

  return data;
}
