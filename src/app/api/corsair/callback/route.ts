import { NextResponse } from "next/server";

import { processOAuthCallback } from "corsair/oauth";

import { corsair } from "@/server/corsair";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const errorDescription = url.searchParams.get("error_description");

      const redirectUrl = new URL("/settings/integrations", request.url);

      redirectUrl.searchParams.set("connection", "error");

      if (errorDescription) {
        redirectUrl.searchParams.set("message", errorDescription);
      }

      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state) {
      return NextResponse.json(
        {
          error: "Missing OAuth code or state.",
        },
        { status: 400 },
      );
    }

    const redirectUri = new URL(
      "/api/corsair/callback",
      request.url,
    ).toString();

    const result = await processOAuthCallback(corsair, {
      code,
      state,
      redirectUri,
    });

    const redirectUrl = new URL("/settings/integrations", request.url);

    redirectUrl.searchParams.set("connection", "success");

    redirectUrl.searchParams.set("plugin", result.plugin);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[Corsair OAuth Callback]", error);

    const redirectUrl = new URL("/settings/integrations", request.url);

    redirectUrl.searchParams.set("connection", "error");

    return NextResponse.redirect(redirectUrl);
  }
}
