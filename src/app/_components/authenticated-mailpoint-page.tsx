import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/lib/auth";
import { MailPointApp } from "@/app/_components/mailpoint-app";
import type { AppSection } from "@/app/_components/app-sidebar";

export async function AuthenticatedMailPointPage({
  section,
}: {
  section: AppSection;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <MailPointApp initialSection={section} />;
}
