import { db } from "@/server/db";
import { corsairPermissions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { CalendarEventProposal, AgentConfirmation } from "@/lib/agent-types";
import type { corsair } from "@/server/corsair";

interface StoredConfirmation {
  id: string;
  token: string;
  userId: string;
  tenantId: string;
  action: "create_calendar_event";
  proposal: CalendarEventProposal;
  status: "pending" | "executing" | "confirmed" | "cancelled";
  createdAt: string;
  expiresAt: string;
  /** Cached result from the first successful execution — returned on duplicate confirm requests */
  executionResult?: ConfirmCalendarEventResult;
}

// In-memory cache for fast lookups and fallback
const confirmationStore = new Map<string, StoredConfirmation>();

export async function createPendingConfirmation(
  userId: string,
  tenantId: string,
  proposal: CalendarEventProposal,
): Promise<AgentConfirmation> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const record: StoredConfirmation = {
    id,
    token,
    userId,
    tenantId,
    action: "create_calendar_event",
    proposal,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt,
  };

  confirmationStore.set(token, record);

  try {
    await db.insert(corsairPermissions).values({
      id,
      token,
      plugin: "googlecalendar",
      endpoint: "events.create",
      args: JSON.stringify({
        event: proposal,
        sendUpdates: "all",
      }),
      tenantId,
      status: "pending",
      expiresAt,
    });
  } catch (err) {
    console.warn("[CalendarConfirmation] DB insert skipped or failed:", err);
  }

  return {
    id,
    token,
    action: "create_calendar_event",
    proposal,
    status: "pending",
    createdAt: record.createdAt,
    expiresAt,
  };
}

export async function getPendingConfirmation(
  token: string,
  userId: string,
): Promise<StoredConfirmation | null> {
  const memRecord = confirmationStore.get(token);
  if (memRecord) {
    if (memRecord.userId !== userId) {
      return null;
    }
    return memRecord;
  }

  try {
    const dbRecord = await db.query.corsairPermissions.findFirst({
      where: eq(corsairPermissions.token, token),
    });

    if (dbRecord) {
      let proposal: CalendarEventProposal;
      try {
        const parsedArgs = JSON.parse(dbRecord.args) as { event?: CalendarEventProposal };
        proposal = parsedArgs.event ?? (parsedArgs as unknown as CalendarEventProposal);
      } catch {
        return null;
      }

      // Map DB status values to in-memory status.
      // "approved" in the DB means we started executing but the server
      // restarted before finishing — reset to "pending" so the user can retry.
      // "denied" in the DB means cancelled.
      function mapDbStatus(s: string): StoredConfirmation["status"] {
        if (s === "confirmed") return "confirmed";
        if (s === "denied" || s === "cancelled") return "cancelled";
        // "approved" (mid-execution at restart) and "pending" both map to pending
        return "pending";
      }

      const record: StoredConfirmation = {
        id: dbRecord.id,
        token: dbRecord.token,
        userId,
        tenantId: dbRecord.tenantId ?? userId,
        action: "create_calendar_event",
        proposal,
        status: mapDbStatus(dbRecord.status),
        createdAt: dbRecord.createdAt.toISOString(),
        expiresAt: dbRecord.expiresAt,
      };
      confirmationStore.set(token, record);
      return record;
    }
  } catch (err) {
    console.warn("[CalendarConfirmation] DB lookup failed:", err);
  }

  return null;
}

import { encodeRawEmail } from "@/server/lib/email";

function formatEmailMeetingTime(
  startStr: string,
  endStr: string,
  timeZone?: string,
): string {
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timeZone ?? undefined,
    }).format(s);

    const startTimeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone ?? undefined,
    }).format(s);

    const endTimeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timeZone ?? undefined,
    }).format(e);

    return `${dateFormatted} · ${startTimeFormatted} – ${endTimeFormatted}`;
  } catch {
    return `${startStr} – ${endStr}`;
  }
}

export type ConfirmCalendarEventResult = {
  success: boolean;
  message?: string;
  event?: unknown;
  emailResult?: {
    sent: boolean;
    recipients?: string[];
    error?: string;
  };
  error?: string;
};

export async function confirmCalendarEvent(
  corsairInstance: typeof corsair,
  token: string,
  userId: string,
  tenantId: string,
): Promise<ConfirmCalendarEventResult> {
  const stored = await getPendingConfirmation(token, userId);
  if (!stored) {
    return { success: false, error: "Confirmation token not found or expired." };
  }

  // Idempotency: if already confirmed, return the cached result immediately — no duplicate event
  if (stored.status === "confirmed") {
    return stored.executionResult ?? {
      success: true,
      message: `Calendar event "${stored.proposal.summary}" was already scheduled successfully.`,
    };
  }

  // Idempotency: if currently executing (concurrent double-click), indicate in-progress
  if (stored.status === "executing") {
    return {
      success: false,
      error: "This confirmation is currently being processed. Please wait a moment.",
    };
  }

  if (stored.status === "cancelled") {
    return { success: false, error: "This meeting proposal was cancelled." };
  }

  // Check expiration
  if (new Date(stored.expiresAt) < new Date()) {
    return { success: false, error: "Confirmation token has expired." };
  }

  // Transition to executing to block concurrent duplicate requests
  stored.status = "executing";
  confirmationStore.set(token, stored);

  // Update DB to approved to ensure audit trail reflects approval
  try {
    await db
      .update(corsairPermissions)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(corsairPermissions.token, token));
  } catch (err) {
    console.warn("[CalendarConfirmation] DB status update failed:", err);
  }

  const tenantScoped = corsairInstance.withTenant(tenantId) as unknown as {
    googlecalendar: {
      api: {
        events: {
          create: (args: {
            calendarId?: string;
            event: CalendarEventProposal;
            sendUpdates: string;
          }) => Promise<Record<string, unknown>>;
          getMany: (args: {
            calendarId?: string;
            timeMin: string;
            timeMax: string;
            singleEvents?: boolean;
          }) => Promise<unknown>;
        };
      };
      db?: {
        events?: {
          upsertByEntityId: (
            id: string,
            data: Record<string, unknown>,
          ) => Promise<unknown>;
        };
      };
    };
    gmail: {
      api: {
        messages: {
          send: (args: { raw: string }) => Promise<unknown>;
        };
      };
    };
  };

  // ── Step 1: Create the Google Calendar event ───────────────────────────────
  // The event is created on the connected user's primary calendar.
  // stored.proposal.attendees is passed as-is so Google Calendar handles
  // the invitation flow for all participants (e.g. Neeraj, Rahul, etc.).
  // MailPoint does not authenticate as attendees or create separate events.
  let createdEvent: Record<string, unknown> | undefined;

  try {
    const result = await tenantScoped.googlecalendar.api.events.create({
      calendarId: "primary",
      event: stored.proposal,
      sendUpdates: "all",
    });

    if (!result || (!result.id && !result.htmlLink && !result.summary)) {
      const failResult: ConfirmCalendarEventResult = {
        success: false,
        error: "Failed to create calendar event via Google Calendar.",
      };
      // Revert to pending so the user can retry if event.create returned nothing
      stored.status = "pending";
      confirmationStore.set(token, stored);
      return failResult;
    }

    createdEvent = result;
  } catch (err: unknown) {
    console.error("[CalendarConfirmation] Execution error:", err);
    const message = err instanceof Error ? err.message : String(err);
    // Revert to pending on a hard error so the user can retry
    stored.status = "pending";
    confirmationStore.set(token, stored);
    return { success: false, error: message };
  }

  // ── Step 2: Sync the newly created event into MailPoint's Calendar cache ───
  const eventId =
    typeof createdEvent.id === "string" ? createdEvent.id : "";

  if (eventId && tenantScoped.googlecalendar.db?.events?.upsertByEntityId) {
    try {
      await tenantScoped.googlecalendar.db.events.upsertByEntityId(eventId, {
        ...createdEvent,
        id: eventId,
        calendarId: "primary",
        createdAt: new Date(),
      });
    } catch (dbErr) {
      console.warn("[CalendarConfirmation] Local cache upsert fallback:", dbErr);
    }
  }

  // Also trigger a week-range sync so the MailPoint Calendar view shows the new event
  try {
    const startTs = new Date(stored.proposal.start.dateTime);
    const weekStart = new Date(startTs);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date(startTs);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await tenantScoped.googlecalendar.api.events.getMany({
      calendarId: "primary",
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
    });
  } catch (syncErr) {
    console.warn("[CalendarConfirmation] Week sync error:", syncErr);
  }

  // ── Step 3: Send supplementary Gmail confirmation email to participants ─────
  // This is supplementary to the Google Calendar invitation already sent.
  // If Gmail fails, Calendar creation is still reported as successful.
  const attendees = (stored.proposal.attendees ?? []).filter(
    (a) => typeof a.email === "string" && a.email.includes("@"),
  );

  const formattedWhen = formatEmailMeetingTime(
    stored.proposal.start.dateTime,
    stored.proposal.end.dateTime,
    stored.proposal.start.timeZone,
  );

  let emailSent = false;
  let emailError: string | undefined;
  let attendeeEmails: string[] = [];

  if (attendees.length > 0) {
    attendeeEmails = attendees.map((a) => a.email);
    const recipientList = attendeeEmails.join(", ");
    const attendeeNames = attendees.map((a) => a.displayName ?? a.email).join(", ");
    const htmlLink =
      typeof createdEvent.htmlLink === "string" ? createdEvent.htmlLink : "";

    const emailBodyLines = [
      `Hi ${attendeeNames},`,
      "",
      `This email confirms our upcoming meeting: "${stored.proposal.summary}".`,
      "",
      `Date & Time: ${formattedWhen}`,
      ...(stored.proposal.location ? [`Location: ${stored.proposal.location}`] : []),
      ...(stored.proposal.description ? ["", "Agenda / Details:", stored.proposal.description] : []),
      ...(htmlLink ? ["", `Calendar Event: ${htmlLink}`] : []),
      "",
      "A Google Calendar invite has been sent to your calendar.",
      "",
      "Looking forward to meeting with you.",
      "",
      "Best regards,",
      "MailPoint",
    ];

    try {
      const raw = encodeRawEmail({
        to: recipientList,
        subject: `Meeting Confirmed: ${stored.proposal.summary}`,
        body: emailBodyLines.join("\n"),
      });

      await tenantScoped.gmail.api.messages.send({ raw });
      emailSent = true;
    } catch (err: unknown) {
      console.error("[CalendarConfirmation] Failed to send confirmation email:", err);
      emailError = err instanceof Error ? err.message : String(err);
    }
  }

  // ── Step 4: Build the final result and mark as confirmed ───────────────────
  const recipientListStr = attendeeEmails.join(", ");

  let message: string;
  if (emailSent) {
    message = `Calendar event "${stored.proposal.summary}" was scheduled successfully for ${formattedWhen}, and a confirmation email was sent to ${recipientListStr}.`;
  } else if (attendees.length > 0) {
    message = `Calendar event "${stored.proposal.summary}" was scheduled successfully for ${formattedWhen}. Note: the confirmation email to ${recipientListStr} could not be delivered (${emailError ?? "email service error"}).`;
  } else {
    message = `Calendar event "${stored.proposal.summary}" was scheduled successfully for ${formattedWhen}.`;
  }

  const finalResult: ConfirmCalendarEventResult = {
    success: true,
    message,
    event: createdEvent,
    emailResult: attendees.length > 0
      ? {
          sent: emailSent,
          recipients: attendeeEmails,
          ...(emailError ? { error: emailError } : {}),
        }
      : undefined,
  };

  // Persist success and cache result for idempotency
  stored.status = "confirmed";
  stored.executionResult = finalResult;
  confirmationStore.set(token, stored);

  return finalResult;
}

export async function cancelCalendarEvent(
  token: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const stored = await getPendingConfirmation(token, userId);
  if (!stored) {
    return { success: false, error: "Confirmation token not found or expired." };
  }

  if (stored.status !== "pending") {
    return {
      success: false,
      error: `Confirmation token has already been ${stored.status}.`,
    };
  }

  stored.status = "cancelled";
  confirmationStore.set(token, stored);

  try {
    await db
      .update(corsairPermissions)
      .set({ status: "denied", updatedAt: new Date() })
      .where(eq(corsairPermissions.token, token));
  } catch (err) {
    console.warn("[CalendarConfirmation] DB status update failed:", err);
  }

  return { success: true };
}
