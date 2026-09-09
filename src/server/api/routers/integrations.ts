import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import {
  corsairAccounts,
  corsairEntities,
  corsairEvents,
  corsairIntegrations,
} from "@/server/db/schema";
import { getTenantId } from "@/server/lib/tenant";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Disconnect all Google services (Gmail + Google Calendar) for the current
 * tenant.  Because Corsair has no first-class "revoke" API we delete the
 * corsair_accounts rows directly.  Cascade rules handle the child entity /
 * event rows via the accountId FK.
 *
 * Order of operations
 * -------------------
 * 1. Resolve the tenant ID for the authenticated user.
 * 2. Find the integration IDs for the "gmail" and "googlecalendar" plugins.
 * 3. Find the corsair_accounts rows that match this tenant + those integrations.
 * 4. Delete child rows (corsair_entities, corsair_events) first so we don't
 *    rely on DB-level cascade being set up.
 * 5. Delete the corsair_accounts rows themselves.
 */
export const integrationsRouter = createTRPCRouter({
  disconnectGoogle: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = await getTenantId(ctx.session.user.id);

    // 1. Look up the integration rows for the two Google plugins.
    const integrations = await db
      .select({ id: corsairIntegrations.id, name: corsairIntegrations.name })
      .from(corsairIntegrations)
      .where(inArray(corsairIntegrations.name, ["gmail", "googlecalendar"]));

    if (integrations.length === 0) {
      // Nothing to disconnect — treat as success.
      return { disconnected: [] };
    }

    const integrationIds = integrations.map((i) => i.id);

    // 2. Find the tenant's account rows for these integrations.
    const accounts = await db
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .where(
        and(
          eq(corsairAccounts.tenantId, tenantId),
          inArray(corsairAccounts.integrationId, integrationIds),
        ),
      );

    if (accounts.length === 0) {
      return { disconnected: [] };
    }

    const accountIds = accounts.map((a) => a.id);

    // 3. Delete child rows first (no guaranteed DB cascade).
    await db
      .delete(corsairEvents)
      .where(inArray(corsairEvents.accountId, accountIds));

    await db
      .delete(corsairEntities)
      .where(inArray(corsairEntities.accountId, accountIds));

    // 4. Delete the account rows — this removes the stored OAuth tokens.
    await db
      .delete(corsairAccounts)
      .where(inArray(corsairAccounts.id, accountIds));

    return { disconnected: integrations.map((i) => i.name) };
  }),
});
