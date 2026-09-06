import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { AdminDashboard } from "@/app/_components/admin-dashboard";
import { auth } from "@/server/lib/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminDashboard />;
}
