import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { aiUsageDaily } from "@/server/db/schema";

export class AiDailyQuotaExceededError extends Error {
  constructor(
    readonly usageDate: string,
    readonly limit: number,
    readonly requestCount: number,
  ) {
    super("Daily AI request limit reached.");
    this.name = "AiDailyQuotaExceededError";
  }
}

function getLocalDate(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`;
    }
  } catch {
    // Fall back to UTC when the supplied timezone is invalid.
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically consumes one user-facing AI request for the tenant.
 *
 * The increment happens before the AI provider is called. This deliberately
 * counts an accepted AI request even if the provider later fails, preventing
 * repeated retries from bypassing the daily quota.
 *
 * Pro has no product-level daily limit and should not call this function.
 */
export async function consumeAiRequest(params: {
  tenantId: string;
  timeZone: string;
  dailyLimit: number;
}): Promise<{ usageDate: string; requestCount: number; limit: number }> {
  const { tenantId, timeZone, dailyLimit } = params;

  if (!Number.isInteger(dailyLimit) || dailyLimit < 1) {
    throw new Error("Invalid AI daily limit.");
  }

  const usageDate = getLocalDate(timeZone);
  const now = new Date();
  const id = `ai_usage_${tenantId}_${usageDate}`;

  // PostgreSQL evaluates the WHERE condition while holding the conflicting
  // row lock, making this safe when multiple requests arrive concurrently.
  const [updated] = await db
    .insert(aiUsageDaily)
    .values({
      id,
      tenantId,
      usageDate,
      requestCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [aiUsageDaily.tenantId, aiUsageDaily.usageDate],
      set: {
        requestCount: sql`${aiUsageDaily.requestCount} + 1`,
        updatedAt: now,
      },
      where: sql`${aiUsageDaily.requestCount} < ${dailyLimit}`,
    })
    .returning({ requestCount: aiUsageDaily.requestCount });

  if (updated) {
    return {
      usageDate,
      requestCount: updated.requestCount,
      limit: dailyLimit,
    };
  }

  const [current] = await db
    .select({ requestCount: aiUsageDaily.requestCount })
    .from(aiUsageDaily)
    .where(
      and(
        eq(aiUsageDaily.tenantId, tenantId),
        eq(aiUsageDaily.usageDate, usageDate),
      ),
    )
    .limit(1);

  throw new AiDailyQuotaExceededError(
    usageDate,
    dailyLimit,
    current?.requestCount ?? dailyLimit,
  );
}

export async function getAiUsageToday(params: {
  tenantId: string;
  timeZone: string;
}): Promise<{ usageDate: string; requestCount: number }> {
  const usageDate = getLocalDate(params.timeZone);
  const [usage] = await db
    .select({ requestCount: aiUsageDaily.requestCount })
    .from(aiUsageDaily)
    .where(
      and(
        eq(aiUsageDaily.tenantId, params.tenantId),
        eq(aiUsageDaily.usageDate, usageDate),
      ),
    )
    .limit(1);

  return {
    usageDate,
    requestCount: usage?.requestCount ?? 0,
  };
}
