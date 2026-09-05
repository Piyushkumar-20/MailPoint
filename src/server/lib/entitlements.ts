import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  entitlementAuditLogs,
  entitlements,
  plans,
} from "@/server/db/schema";

export type PlanKey = "free" | "pro";
export type EntitlementSource = "system" | "self_paid" | "admin_granted";

export type EntitlementDetails = {
  entitlementId: string;
  tenantId: string;
  planId: string;
  planKey: PlanKey;
  planName: string;
  source: EntitlementSource;
  status: "active" | "revoked" | "expired";
  aiDailyLimit: number | null;
  startsAt: Date;
  endsAt: Date | null;
  subscriptionId: string | null;
};

export async function getEntitlementByTenantId(
  tenantId: string,
): Promise<EntitlementDetails | null> {
  const row = await db
    .select({
      entitlement: entitlements,
      plan: plans,
    })
    .from(entitlements)
    .innerJoin(plans, eq(entitlements.planId, plans.id))
    .where(eq(entitlements.tenantId, tenantId))
    .limit(1);

  const item = row[0];
  if (!item) return null;

  const now = new Date();
  const isExpired =
    item.entitlement.status === "active" &&
    item.entitlement.endsAt !== null &&
    item.entitlement.endsAt <= now;

  if (isExpired) {
    await db
      .update(entitlements)
      .set({
        planId: "plan_free",
        source: "system",
        status: "active",
        subscriptionId: null,
        grantedByUserId: null,
        startsAt: now,
        endsAt: null,
        revokedAt: null,
        updatedAt: now,
      })
      .where(eq(entitlements.id, item.entitlement.id));

    const freePlan = await db
      .select({ plan: plans })
      .from(plans)
      .where(eq(plans.id, "plan_free"))
      .limit(1);

    if (!freePlan[0]) throw new Error("Free plan is missing");

    return {
      entitlementId: item.entitlement.id,
      tenantId,
      planId: freePlan[0].plan.id,
      planKey: "free",
      planName: freePlan[0].plan.name,
      source: "system",
      status: "active",
      aiDailyLimit: freePlan[0].plan.aiDailyLimit,
      startsAt: now,
      endsAt: null,
      subscriptionId: null,
    };
  }

  if (item.entitlement.status !== "active") {
    return null;
  }

  return {
    entitlementId: item.entitlement.id,
    tenantId: item.entitlement.tenantId,
    planId: item.plan.id,
    planKey: item.plan.key,
    planName: item.plan.name,
    source: item.entitlement.source,
    status: item.entitlement.status,
    aiDailyLimit: item.plan.aiDailyLimit,
    startsAt: item.entitlement.startsAt,
    endsAt: item.entitlement.endsAt,
    subscriptionId: item.entitlement.subscriptionId,
  };
}

export async function ensureFreeEntitlement(tenantId: string): Promise<void> {
  const existing = await db.query.entitlements.findFirst({
    where: eq(entitlements.tenantId, tenantId),
    columns: { id: true },
  });

  if (existing) return;

  await db
    .insert(entitlements)
    .values({
      id: `entitlement_${tenantId}`,
      tenantId,
      planId: "plan_free",
      source: "system",
      status: "active",
    })
    .onConflictDoNothing({ target: entitlements.tenantId });
}

export async function grantAdminProEntitlement(params: {
  tenantId: string;
  actorUserId: string;
  reason?: string;
  endsAt?: Date | null;
}): Promise<EntitlementDetails> {
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.entitlements.findFirst({
      where: eq(entitlements.tenantId, params.tenantId),
    });

    const entitlementId = existing?.id ?? `entitlement_${params.tenantId}`;

    if (existing) {
      await tx
        .update(entitlements)
        .set({
          planId: "plan_pro",
          source: "admin_granted",
          status: "active",
          subscriptionId: null,
          grantedByUserId: params.actorUserId,
          startsAt: now,
          endsAt: params.endsAt ?? null,
          revokedAt: null,
          updatedAt: now,
        })
        .where(eq(entitlements.id, existing.id));
    } else {
      await tx.insert(entitlements).values({
        id: entitlementId,
        tenantId: params.tenantId,
        planId: "plan_pro",
        source: "admin_granted",
        status: "active",
        grantedByUserId: params.actorUserId,
        startsAt: now,
        endsAt: params.endsAt ?? null,
      });
    }

    await tx.insert(entitlementAuditLogs).values({
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      entitlementId,
      actorUserId: params.actorUserId,
      action: "grant",
      source: "admin_granted",
      reason: params.reason ?? null,
      metadata: {
        planKey: "pro",
        endsAt: params.endsAt?.toISOString() ?? null,
      },
    });

    return entitlementId;
  });

  const entitlement = await getEntitlementByTenantId(params.tenantId);
  if (!entitlement) {
    throw new Error(`Failed to load entitlement ${result}`);
  }

  return entitlement;
}

export async function revokeEntitlement(params: {
  tenantId: string;
  actorUserId?: string;
  reason?: string;
}): Promise<EntitlementDetails> {
  const now = new Date();

  await db.transaction(async (tx) => {
    const existing = await tx.query.entitlements.findFirst({
      where: eq(entitlements.tenantId, params.tenantId),
    });

    if (!existing) {
      throw new Error(`No entitlement exists for tenant ${params.tenantId}`);
    }

    await tx
      .update(entitlements)
      .set({
        planId: "plan_free",
        source: "system",
        status: "active",
        subscriptionId: null,
        grantedByUserId: null,
        startsAt: now,
        endsAt: null,
        revokedAt: null,
        updatedAt: now,
      })
      .where(eq(entitlements.id, existing.id));

    await tx.insert(entitlementAuditLogs).values({
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      entitlementId: existing.id,
      actorUserId: params.actorUserId ?? null,
      action: "revoke",
      source: existing.source,
      reason: params.reason ?? null,
      metadata: {
        previousPlanId: existing.planId,
        previousSource: existing.source,
      },
    });
  });

  const entitlement = await getEntitlementByTenantId(params.tenantId);
  if (!entitlement) {
    throw new Error(`Failed to restore free entitlement for tenant ${params.tenantId}`);
  }

  return entitlement;
}

export function isProEntitlement(entitlement: EntitlementDetails | null) {
  return entitlement?.planKey === "pro" && entitlement.status === "active";
}

export async function activateSelfPaidProEntitlement(params: {
  tenantId: string;
  paymentId: string;
  amount: number;
  currency: string;
}): Promise<EntitlementDetails> {
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setMonth(endsAt.getMonth() + 1);

  await db.transaction(async (tx) => {
    const existing = await tx.query.entitlements.findFirst({
      where: eq(entitlements.tenantId, params.tenantId),
    });

    const entitlementId = existing?.id ?? `entitlement_${params.tenantId}`;

    if (existing) {
      await tx
        .update(entitlements)
        .set({
          planId: "plan_pro",
          source: "self_paid",
          status: "active",
          subscriptionId: null,
          grantedByUserId: null,
          startsAt: now,
          endsAt,
          revokedAt: null,
          updatedAt: now,
        })
        .where(eq(entitlements.id, existing.id));
    } else {
      await tx.insert(entitlements).values({
        id: entitlementId,
        tenantId: params.tenantId,
        planId: "plan_pro",
        source: "self_paid",
        status: "active",
        startsAt: now,
        endsAt,
      });
    }

    await tx.insert(entitlementAuditLogs).values({
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      entitlementId,
      action: "purchase",
      source: "self_paid",
      reason: "Razorpay Standard Checkout payment verified",
      metadata: {
        paymentId: params.paymentId,
        amount: params.amount,
        currency: params.currency,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    });
  });

  const entitlement = await getEntitlementByTenantId(params.tenantId);
  if (!entitlement) {
    throw new Error("Failed to load self-paid Pro entitlement after purchase");
  }

  return entitlement;
}
