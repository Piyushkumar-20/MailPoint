import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { tenant, tenantMembers } from "@/server/db/schema";
import { corsair } from "@/server/corsair";
import { ensureFreeEntitlement } from "@/server/lib/entitlements";

export async function getTenantId(userId: string) {
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

  const tenantId = membership?.tenantId ?? userId;
  await ensureFreeEntitlement(tenantId);

  return tenantId;
}

export async function getTenant(userId: string) {
  return corsair.withTenant(await getTenantId(userId));
}
