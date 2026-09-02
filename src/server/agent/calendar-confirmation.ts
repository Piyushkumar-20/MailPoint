import "server-only";

import { and, eq, gt, lte } from "drizzle-orm";
import { z } from "zod";

import {
  calendarActionProposalSchema,
  type CalendarActionProposal,
} from "@/lib/agent-types";
import { db } from "@/server/db";
import { verification } from "@/server/db/schema";

const CALENDAR_CONFIRMATION_PREFIX = "calendar_confirmation";
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

const calendarConfirmationPayloadSchema = z.object({
  version: z.literal(1),
  type: z.literal("calendar_event"),
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  action: calendarActionProposalSchema,
  corsairPermissionToken: z.string().min(1).optional(),
  approvalUrl: z.string().url().optional(),
});

export type CalendarConfirmationPayload = z.infer<
  typeof calendarConfirmationPayloadSchema
>;

export type CalendarConfirmationConsumeResult =
  | {
      status: "ok";
      payload: CalendarConfirmationPayload;
    }
  | {
      status: "invalid" | "expired" | "unauthorized";
    };

function getIdentifier(userId: string, token: string) {
  return `${CALENDAR_CONFIRMATION_PREFIX}:${userId}:${token}`;
}

async function getCalendarConfirmationRecord({
  userId,
  token,
}: {
  userId: string;
  token: string;
}) {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return { status: "invalid" as const };
  }

  const identifier = getIdentifier(userId, trimmedToken);
  const now = new Date();

  const record = await db.query.verification.findFirst({
    where: and(
      eq(verification.identifier, identifier),
      gt(verification.expiresAt, now),
    ),
  });

  if (record) {
    return { status: "ok" as const, identifier, record };
  }

  const expired = await db.query.verification.findFirst({
    where: and(
      eq(verification.identifier, identifier),
      lte(verification.expiresAt, now),
    ),
  });

  if (expired) {
    await db
      .delete(verification)
      .where(eq(verification.identifier, identifier));

    return { status: "expired" as const };
  }

  return { status: "invalid" as const };
}

function parsePayload(value: string): CalendarConfirmationPayload | null {
  try {
    const parsed = calendarConfirmationPayloadSchema.safeParse(
      JSON.parse(value),
    );

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createCalendarConfirmationToken({
  userId,
  tenantId,
  action,
}: {
  userId: string;
  tenantId: string;
  action: CalendarActionProposal;
}) {
  const now = new Date();
  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS);

  const payload = calendarConfirmationPayloadSchema.parse({
    version: 1,
    type: "calendar_event",
    userId,
    tenantId,
    action,
  });

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: getIdentifier(userId, token),
    value: JSON.stringify(payload),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return token;
}

export async function consumeCalendarConfirmationToken({
  userId,
  token,
}: {
  userId: string;
  token: string;
}): Promise<CalendarConfirmationConsumeResult> {
  const result = await getCalendarConfirmationRecord({ userId, token });

  if (result.status !== "ok") {
    return result;
  }

  const payload = parsePayload(result.record.value);

  if (!payload) {
    return { status: "invalid" };
  }

  if (payload.userId !== userId) {
    return { status: "unauthorized" };
  }

  return {
    status: "ok",
    payload,
  };
}

export async function updateCalendarConfirmationApproval({
  userId,
  token,
  corsairPermissionToken,
  approvalUrl,
}: {
  userId: string;
  token: string;
  corsairPermissionToken?: string;
  approvalUrl?: string;
}) {
  const result = await getCalendarConfirmationRecord({ userId, token });

  if (result.status !== "ok") {
    return result;
  }

  const payload = parsePayload(result.record.value);

  if (payload && payload.userId !== userId) {
    return { status: "unauthorized" as const };
  }

  if (!payload) {
    return { status: "invalid" as const };
  }

  const updatedPayload = calendarConfirmationPayloadSchema.parse({
    ...payload,
    ...(corsairPermissionToken !== undefined ? { corsairPermissionToken } : {}),
    ...(approvalUrl !== undefined ? { approvalUrl } : {}),
  });

  await db
    .update(verification)
    .set({
      value: JSON.stringify(updatedPayload),
      updatedAt: new Date(),
    })
    .where(eq(verification.identifier, result.identifier));

  return {
    status: "ok" as const,
    payload: updatedPayload,
  };
}

export async function deleteCalendarConfirmationToken({
  userId,
  token,
}: {
  userId: string;
  token: string;
}) {
  await db
    .delete(verification)
    .where(eq(verification.identifier, getIdentifier(userId, token.trim())));
}
