import { NextResponse } from "next/server";

import { auth } from "@/server/lib/auth";
import { corsair } from "@/server/corsair";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { connectUrl, expiresAt } =
    await corsair.manage.connect.createLink({
      tenantId: session.user.id,
      oauthMode: "managed",
    });

  return NextResponse.json({
    connectUrl,
    expiresAt,
  });
}