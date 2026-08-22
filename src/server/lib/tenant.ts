import { corsair } from "@/server/corsair";

export function getTenant() {
  const tenantId = process.env.TENANT_ID ?? "piyush";
  return corsair.withTenant(tenantId);
}
