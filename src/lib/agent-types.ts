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

export type EmailItem = {
  id?: string;
  from?: string;
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  snippet?: string;
  date?: string;
  time?: string;
  rawDate?: string;
  tags?: string[];
  unread?: boolean;
};

export type CalendarEventItem = {
  id?: string;
  summary: string;
  start: string;
  end?: string;
  duration?: string;
  location?: string;
  meetLink?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  status?: string;
};

export type AvailabilityData = {
  isAvailable: boolean;
  requestedTime?: {
    start: string;
    end: string;
    durationMinutes?: number;
  };
  conflicts?: Array<{ calendar?: string; start: string; end: string; summary?: string }>;
  suggestedAlternatives?: Array<{ start: string; end: string }>;
  warnings?: string[];
};

export type AgentStructuredData =
  | {
      type: "email-list" | "search-results";
      title?: string;
      subtitle?: string;
      count?: number;
      items: EmailItem[];
      query?: string;
    }
  | {
      type: "calendar-list";
      title?: string;
      subtitle?: string;
      count?: number;
      items: CalendarEventItem[];
    }
  | {
      type: "availability";
      title?: string;
      data: AvailabilityData;
    }
  | {
      type: "empty";
      title?: string;
      message?: string;
      query?: string;
    }
  | {
      type: "error";
      title?: string;
      message: string;
      code?: string;
    };

export const agentResponseSchema = z.object({
  output: z.string(),
  confirmation: agentConfirmationSchema.optional(),
  structuredData: z.custom<AgentStructuredData>().optional(),
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


