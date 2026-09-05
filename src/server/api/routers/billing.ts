import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { getTenantId } from "@/server/lib/tenant";
import { getEntitlementByTenantId } from "@/server/lib/entitlements";
import { getAiUsageToday } from "@/server/lib/ai-usage";

export const billingRouter = createTRPCRouter({
  getEntitlement: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = await getTenantId(ctx.session.user.id);
    const entitlement = await getEntitlementByTenantId(tenantId);

    return {
      tenantId,
      entitlement,
    };
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
