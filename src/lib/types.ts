import type { AgentConfirmation } from "@/lib/agent-types";

export type AgentMessageRole = "user" | "assistant";

export type Message = {
  id: string;
  role: AgentMessageRole;
  content: string;
  confirmation?: AgentConfirmation;
};

