import { z } from "zod";

export const calendarActionProposalSchema = z.object({
  type: z.literal("calendar_event"),
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  attendees: z.array(z.string()),
});

export const agentConfirmationSchema = z.object({
  type: z.literal("calendar_event"),
  token: z.string().min(1),
  action: calendarActionProposalSchema,
  status: z
    .enum([
      "pending",
      "approval_required",
      "confirmed",
      "cancelled",
      "error",
    ])
    .optional(),
  approvalUrl: z.string().url().optional(),
  result: z
    .object({
      eventId: z.string(),
      htmlLink: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const agentResponseSchema = z.object({
  output: z.string(),
  confirmation: agentConfirmationSchema.nullable(),
});

export const calendarConfirmationResultSchema = z.object({
  status: z.literal("confirmed"),
  output: z.string(),
  event: z.object({
    id: z.string(),
    htmlLink: z.string(),
  }),
});

export const calendarApprovalRequiredSchema = z.object({
  status: z.literal("approval_required"),
  output: z.string(),
  approvalUrl: z.string().url(),
});

export const calendarConfirmationResponseSchema = z.union([
  calendarConfirmationResultSchema,
  calendarApprovalRequiredSchema,
]);

export type CalendarActionProposal = z.infer<
  typeof calendarActionProposalSchema
>;

export type AgentConfirmation = z.infer<
  typeof agentConfirmationSchema
>;

export type AgentResponse = z.infer<typeof agentResponseSchema>;

export type CalendarConfirmationResult = z.infer<
  typeof calendarConfirmationResultSchema
>;

export type CalendarApprovalRequired = z.infer<
  typeof calendarApprovalRequiredSchema
>;

export type CalendarConfirmationResponse = z.infer<
  typeof calendarConfirmationResponseSchema
>;
