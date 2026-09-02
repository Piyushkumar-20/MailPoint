import { NextResponse } from "next/server";

import { runMailPointAgent } from "@/server/agent/agent";
import { auth } from "@/server/lib/auth";
import { getTenant, getTenantId } from "@/server/lib/tenant";
import { createPendingConfirmation } from "@/server/agent/calendar-confirmation";
import type { AgentResponse } from "@/lib/agent-types";

type AgentRequestBody = {
  input?: unknown;
  timezone?: unknown;
};

function getCurrentDateTime(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: "UTC",
    }).format(new Date());
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as AgentRequestBody;

    if (typeof body.input !== "string" || !body.input.trim()) {
      return NextResponse.json(
        { error: "input is required" },
        { status: 400 },
      );
    }

    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "UTC";

    const tenantId = await getTenantId(session.user.id);
    const corsair = await getTenant(session.user.id);

    const result = await runMailPointAgent(
      corsair,
      body.input.trim(),
      {
        timezone,
        currentDateTime: getCurrentDateTime(timezone),
      },
    );

    let confirmation;
    if (result.proposal) {
      confirmation = await createPendingConfirmation(
        session.user.id,
        tenantId,
        result.proposal,
      );
    }

    const responsePayload: AgentResponse = {
      output: result.finalOutput,
      confirmation,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("[Agent API]", error);

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("no credits remaining")
    ) {
      return NextResponse.json(
        {
          error: "AI service is temporarily unavailable.",
          code: "AI_CREDITS_EXHAUSTED",
        },
        { status: 503 },
      );
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("request size limit")
    ) {
      return NextResponse.json(
        {
          error: "Request size limit exceeded. Please try a simpler or shorter request.",
          code: "REQUEST_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to process agent request.",
      },
      { status: 500 },
    );
  }
}

