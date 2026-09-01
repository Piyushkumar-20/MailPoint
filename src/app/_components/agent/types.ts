export type AgentMessageRole = "user" | "assistant";

export type Message = {
  id: string;
  role: AgentMessageRole;
  content: string;
  confirmation?: AgentConfirmation;
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
