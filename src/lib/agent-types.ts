import { z } from "zod";

export const calendarEventProposalSchema = z.object({
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.object({
    dateTime: z.string(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: z.string().optional(),
  }),
  attendees: z
    .array(
      z.object({
        email: z.string(),
        displayName: z.string().optional(),
      }),
    )
    .optional(),
});

export type CalendarEventProposal = z.infer<typeof calendarEventProposalSchema>;

export const agentConfirmationSchema = z.object({
  id: z.string(),
  token: z.string(),
  action: z.literal("create_calendar_event"),
  proposal: calendarEventProposalSchema,
  status: z.enum(["pending", "confirmed", "cancelled"]).default("pending"),
  createdAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type AgentConfirmation = z.infer<typeof agentConfirmationSchema>;

export const agentResponseSchema = z.object({
  output: z.string(),
  confirmation: agentConfirmationSchema.optional(),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;

export const confirmRequestSchema = z.object({
  token: z.string(),
  action: z.enum(["confirm", "cancel"]).default("confirm"),
});

export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;

export const confirmResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(["confirmed", "cancelled", "error"]),
  message: z.string(),
  event: z
    .object({
      id: z.string().optional(),
      summary: z.string().optional(),
      start: z.any().optional(),
      end: z.any().optional(),
      htmlLink: z.string().optional(),
    })
    .optional(),
  emailResult: z
    .object({
      sent: z.boolean(),
      recipients: z.array(z.string()).optional(),
      error: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export type ConfirmResponse = z.infer<typeof confirmResponseSchema>;


