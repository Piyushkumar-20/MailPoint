import { redirect } from "next/navigation";

import { auth } from "@/server/lib/auth";
import { headers } from "next/headers";

import { MailPointApp } from "./_components/mailpoint-app";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <MailPointApp />;
}