import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { tenant, tenantMembers } from "@/server/db/schema";
import { corsair } from "@/server/corsair";

export async function getTenant(userId: string) {
  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, userId),
  });

  if (!membership) {
    await db.insert(tenant).values({
      id: userId,
      name: "Personal",
    });

    await db.insert(tenantMembers).values({
      id: crypto.randomUUID(),
      tenantId: userId,
      userId,
      role: "owner",
    });
  }

  const resolvedTenantId = membership?.tenantId ?? userId;

  return corsair.withTenant(resolvedTenantId);
}