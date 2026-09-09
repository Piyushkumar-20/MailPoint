import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getTenantId } from "@/server/lib/tenant";
import { getEntitlementByTenantId } from "@/server/lib/entitlements";
import { getAiUsageToday } from "@/server/lib/ai-usage";
import { plans } from "@/server/db/schema";
import { db } from "@/server/db";

export const billingRouter = createTRPCRouter({
  getEntitlement: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = await getTenantId(ctx.session.user.id);
    const entitlement = await getEntitlementByTenantId(tenantId);

    return {
      tenantId,
      entitlement,
    };
  }),

  getPlans: protectedProcedure.query(async () => {
    const rows = await db
      .select({
        id: plans.id,
        key: plans.key,
        name: plans.name,
        priceAmount: plans.priceAmount,
        currency: plans.currency,
        billingInterval: plans.billingInterval,
        billingIntervalCount: plans.billingIntervalCount,
        aiDailyLimit: plans.aiDailyLimit,
        isActive: plans.isActive,
      })
      .from(plans)
      .where(eq(plans.isActive, true));

    const freePlan = rows.find((r) => r.key === "free") ?? null;
    const proPlan = rows.find((r) => r.key === "pro") ?? null;

    return { freePlan, proPlan };
  }),

  getAiUsage: protectedProcedure
    .input(
      z.object({
        timezone: z.string().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);
      const entitlement = await getEntitlementByTenantId(tenantId);
      const usage = await getAiUsageToday({
        tenantId,
        timeZone: input.timezone,
      });

      return {
        tenantId,
        usage,
        dailyLimit: entitlement?.aiDailyLimit ?? null,
      };
    }),
});
