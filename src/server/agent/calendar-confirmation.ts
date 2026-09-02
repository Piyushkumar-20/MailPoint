import { db } from "@/server/db";
import { corsairPermissions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { CalendarEventProposal, AgentConfirmation } from "@/lib/agent-types";
import { executePermission } from "corsair";
import type { corsair } from "@/server/corsair";

interface StoredConfirmation {
  id: string;
  token: string;
  userId: string;
  tenantId: string;
  action: "create_calendar_event";
  proposal: CalendarEventProposal;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  expiresAt: string;
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

      const record: StoredConfirmation = {
        id: dbRecord.id,
        token: dbRecord.token,
        userId,
        tenantId: dbRecord.tenantId ?? userId,
        action: "create_calendar_event",
        proposal,
        status: (dbRecord.status as "pending" | "confirmed" | "cancelled") || "pending",
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

export async function confirmCalendarEvent(
  corsairInstance: typeof corsair,
  token: string,
  userId: string,
  tenantId: string,
): Promise<{ success: boolean; event?: unknown; error?: string }> {
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

  // Check expiration
  if (new Date(stored.expiresAt) < new Date()) {
    return { success: false, error: "Confirmation token has expired." };
  }

  // Mark as confirmed in memory to prevent race conditions / duplicate execution
  stored.status = "confirmed";
  confirmationStore.set(token, stored);

  // Update DB status to approved so executePermission or audit trails reflect approval
  try {
    await db
      .update(corsairPermissions)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(corsairPermissions.token, token));
  } catch (err) {
    console.warn("[CalendarConfirmation] DB status update failed:", err);
  }

  // Attempt execution via Corsair's executePermission if permissions namespace is available
  try {
    if (corsairInstance?.permissions) {
      const execResult = await executePermission(corsairInstance, token);
      if (execResult && !execResult.error && execResult.result) {
        return { success: true, event: execResult.result };
      }
    }
  } catch (err: unknown) {
    console.warn("[CalendarConfirmation] executePermission fallback:", err);
  }

  try {
    // Direct execution through tenant's Corsair instance
    const tenantScoped = corsairInstance.withTenant(tenantId) as unknown as {
      googlecalendar: {
        api: {
          events: {
            create: (args: { event: CalendarEventProposal; sendUpdates: string }) => Promise<unknown>;
          };
        };
      };
    };

    const result = await tenantScoped.googlecalendar.api.events.create({
      event: stored.proposal,
      sendUpdates: "all",
    });

    return { success: true, event: result };
  } catch (err: unknown) {
    console.error("[CalendarConfirmation] Execution error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
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
