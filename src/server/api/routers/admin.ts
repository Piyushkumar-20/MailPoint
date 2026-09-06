import { and, count, desc, eq, ilike, or, sum } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { users, tenantMembers, tenant, entitlements, plans, payments, billingEvents, entitlementAuditLogs } from "@/server/db/schema";
import {
  getEntitlementByTenantId,
  grantAdminProEntitlement,
  revokeEntitlement,
} from "@/server/lib/entitlements";

const userSearchInput = z.object({
  search: z.string().trim().max(100).optional(),
});

const grantInput = z.object({
  userId: z.string().min(1),
  durationDays: z.number().int().min(1).max(3650).nullable(),
  reason: z.string().trim().max(500).optional(),
});

const revokeInput = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const adminRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: { isAdmin: true },
    });

    return { isAdmin: user?.isAdmin === true };
  }),

  getOverview: adminProcedure.query(async ({ ctx }) => {
    const [
      userCountResult,
      tenantCountResult,
      proCountResult,
      freeCountResult,
      selfPaidResult,
      adminGrantedResult,
      capturedRevenueResult,
      failedPaymentsResult,
      recentPayments,
      recentEvents,
      recentAuditLogs,
    ] = await Promise.all([
      ctx.db.select({ count: count() }).from(users),
      ctx.db.select({ count: count() }).from(tenant),
      ctx.db
        .select({ count: count() })
        .from(entitlements)
        .where(and(eq(entitlements.planId, "plan_pro"), eq(entitlements.status, "active"))),
      ctx.db
        .select({ count: count() })
        .from(entitlements)
        .where(and(eq(entitlements.planId, "plan_free"), eq(entitlements.status, "active"))),
      ctx.db
        .select({ count: count() })
        .from(entitlements)
        .where(
          and(
            eq(entitlements.planId, "plan_pro"),
            eq(entitlements.source, "self_paid"),
            eq(entitlements.status, "active"),
          ),
        ),
      ctx.db
        .select({ count: count() })
        .from(entitlements)
        .where(
          and(
            eq(entitlements.planId, "plan_pro"),
            eq(entitlements.source, "admin_granted"),
            eq(entitlements.status, "active"),
          ),
        ),
      ctx.db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(eq(payments.status, "captured")),
      ctx.db
        .select({ count: count() })
        .from(payments)
        .where(eq(payments.status, "failed")),
      ctx.db
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          providerOrderId: payments.providerOrderId,
          providerPaymentId: payments.providerPaymentId,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(payments)
        .leftJoin(tenantMembers, eq(payments.tenantId, tenantMembers.tenantId))
        .leftJoin(users, eq(tenantMembers.userId, users.id))
        .orderBy(desc(payments.createdAt))
        .limit(10),
      ctx.db
        .select({
          id: billingEvents.id,
          providerEventId: billingEvents.providerEventId,
          eventType: billingEvents.eventType,
          status: billingEvents.status,
          signatureVerified: billingEvents.signatureVerified,
          attemptCount: billingEvents.attemptCount,
          processedAt: billingEvents.processedAt,
          createdAt: billingEvents.createdAt,
          error: billingEvents.error,
        })
        .from(billingEvents)
        .orderBy(desc(billingEvents.createdAt))
        .limit(10),
      ctx.db
        .select({
          id: entitlementAuditLogs.id,
          tenantId: entitlementAuditLogs.tenantId,
          action: entitlementAuditLogs.action,
          source: entitlementAuditLogs.source,
          reason: entitlementAuditLogs.reason,
          createdAt: entitlementAuditLogs.createdAt,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(entitlementAuditLogs)
        .leftJoin(users, eq(entitlementAuditLogs.actorUserId, users.id))
        .orderBy(desc(entitlementAuditLogs.createdAt))
        .limit(10),
    ]);

    return {
      stats: {
        users: userCountResult[0]?.count ?? 0,
        tenants: tenantCountResult[0]?.count ?? 0,
        pro: proCountResult[0]?.count ?? 0,
        free: freeCountResult[0]?.count ?? 0,
        selfPaidPro: selfPaidResult[0]?.count ?? 0,
        adminGrantedPro: adminGrantedResult[0]?.count ?? 0,
        capturedRevenuePaise: Number(capturedRevenueResult[0]?.total ?? 0),
        failedPayments: failedPaymentsResult[0]?.count ?? 0,
      },
      recentPayments,
      recentEvents,
      recentAuditLogs,
    };
  }),

  getUsers: adminProcedure
    .input(userSearchInput)
    .query(async ({ ctx, input }) => {
      const conditions = input.search
        ? or(
            ilike(users.email, `%${input.search}%`),
            ilike(users.name, `%${input.search}%`),
          )
        : undefined;

      const rows = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
          tenantId: tenantMembers.tenantId,
          planKey: plans.key,
          entitlementSource: entitlements.source,
          entitlementStatus: entitlements.status,
          entitlementEndsAt: entitlements.endsAt,
        })
        .from(users)
        .leftJoin(tenantMembers, eq(users.id, tenantMembers.userId))
        .leftJoin(entitlements, eq(tenantMembers.tenantId, entitlements.tenantId))
        .leftJoin(plans, eq(entitlements.planId, plans.id))
        .where(conditions)
        .orderBy(desc(users.createdAt))
        .limit(200);

      return rows;
    }),

  grantPro: adminProcedure
    .input(grantInput)
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      const membership = await ctx.db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, targetUser.id),
        columns: { tenantId: true },
      });

      const tenantId = membership?.tenantId ?? targetUser.id;

      if (membership) {
        const currentEntitlement = await getEntitlementByTenantId(tenantId);

        if (
          currentEntitlement?.planKey === "pro" &&
          currentEntitlement.source === "self_paid" &&
          currentEntitlement.status === "active"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This user already has an active self-paid Pro entitlement.",
          });
        }
      }

      if (!membership) {
        await ctx.db.transaction(async (tx) => {
          await tx
            .insert(tenant)
            .values({
              id: tenantId,
              name: "Personal",
            })
            .onConflictDoNothing();

          await tx
            .insert(tenantMembers)
            .values({
              id: crypto.randomUUID(),
              tenantId,
              userId: targetUser.id,
              role: "owner",
            })
            .onConflictDoNothing();
        });
      }

      const endsAt =
        input.durationDays === null
          ? null
          : new Date(
              Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
            );

      return grantAdminProEntitlement({
        tenantId,
        actorUserId: ctx.session.user.id,
        reason: input.reason ?? "Granted by MailPoint admin",
        endsAt,
      });
    }),

  revokePro: adminProcedure
    .input(revokeInput)
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      const membership = await ctx.db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, targetUser.id),
        columns: { tenantId: true },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User does not have a tenant yet.",
        });
      }

      const currentEntitlement = await getEntitlementByTenantId(
        membership.tenantId,
      );

      if (
        currentEntitlement?.planKey !== "pro" ||
        currentEntitlement.source !== "admin_granted" ||
        currentEntitlement.status !== "active"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only active admin-granted Pro access can be revoked here.",
        });
      }

      return revokeEntitlement({
        tenantId: membership.tenantId,
        actorUserId: ctx.session.user.id,
        reason: input.reason ?? "Revoked by MailPoint admin",
      });
    }),

  getUserEntitlement: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, input.userId),
        columns: { tenantId: true },
      });

      if (!membership) return null;

      return getEntitlementByTenantId(membership.tenantId);
    }),
});
