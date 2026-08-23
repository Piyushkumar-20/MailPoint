import { corsair } from "@/server/corsair";

export function getTenant(userId: string) {
  return corsair.withTenant(userId);
}
