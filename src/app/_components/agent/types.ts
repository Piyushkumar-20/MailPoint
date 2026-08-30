export type AgentMessageRole = "user" | "assistant";

export type Message = {
  id: string;
  role: AgentMessageRole;
  content: string;
};
