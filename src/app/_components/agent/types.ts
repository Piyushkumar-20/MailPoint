import type { AgentConfirmation, AgentStructuredData } from "@/lib/agent-types";

export type AgentMessageRole = "user" | "assistant";

export type Message = {
  id: string;
  role: AgentMessageRole;
  content: string;
  confirmation?: AgentConfirmation;
  structuredData?: AgentStructuredData;
  createdAt?: string;
};