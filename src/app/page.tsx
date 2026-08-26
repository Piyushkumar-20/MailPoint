import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { LandingPage } from "@/components/landing/landing-page";
import { auth } from "@/server/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
