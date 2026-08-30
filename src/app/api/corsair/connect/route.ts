import { NextResponse } from "next/server";

import { generateOAuthUrl } from "corsair/oauth";

import { auth } from "@/server/lib/auth";
import { corsair } from "@/server/corsair";

const ALLOWED_PLUGINS = new Set(["gmail", "googlecalendar"]);

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const plugin = searchParams.get("plugin");

    if (!plugin || !ALLOWED_PLUGINS.has(plugin)) {
      return NextResponse.json(
        {
          error:
            "Invalid plugin. Supported plugins are gmail and googlecalendar.",
        },
        { status: 400 },
      );
    }

    const redirectUri = new URL(
      "/api/corsair/callback",
      request.url,
    ).toString();

    const { url, state } = await generateOAuthUrl(corsair, plugin, {
      tenantId: session.user.id,
      redirectUri,
    });

    return NextResponse.json({
      connectUrl: url,
      state,
    });
  } catch (error) {
    console.error("[Corsair Connect]", error);

    return NextResponse.json(
      {
        error: "Failed to create OAuth connection.",
      },
      { status: 500 },
    );
  }
}
