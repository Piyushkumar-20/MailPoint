export type AgentRequest = {
  input: string;
  timezone: string;
};

export type CalendarActionProposal = {
  type: "calendar_event";
  summary: string;
  start: string;
  end: string;
  attendees: string[];
};

export type AgentConfirmation = {
  type: "calendar_event";
  action: CalendarActionProposal;
};

export type AgentResponse = {
  output: string;
  confirmation: AgentConfirmation | null;
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

function isCalendarActionProposal(
  value: unknown,
): value is CalendarActionProposal {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const proposal = value as Record<string, unknown>;

  return (
    proposal.type === "calendar_event" &&
    typeof proposal.summary === "string" &&
    typeof proposal.start === "string" &&
    typeof proposal.end === "string" &&
    Array.isArray(proposal.attendees) &&
    proposal.attendees.every(
      (attendee): attendee is string =>
        typeof attendee === "string",
    )
  );
}

function isAgentConfirmation(
  value: unknown,
): value is AgentConfirmation {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const confirmation =
    value as Record<string, unknown>;

  return (
    confirmation.type === "calendar_event" &&
    isCalendarActionProposal(confirmation.action)
  );
}

function isAgentResponse(
  value: unknown,
): value is AgentResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.output === "string" &&
    (response.confirmation === null ||
      isAgentConfirmation(response.confirmation))
  );
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

  if (!isAgentResponse(data)) {
    throw new AgentClientError(
      "MailPoint received an unexpected response. Please try again.",
      response.status,
    );
  }

  return data;
}
