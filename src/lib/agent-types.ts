import { z } from "zod";

export const agentResponseSchema = z.object({
  output: z.string(),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
