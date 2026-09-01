import { NextResponse } from "next/server";

import { runMailPointAgent } from "@/server/agent/agent";
import { createCalendarConfirmationToken } from "@/server/agent/calendar-confirmation";
import { auth } from "@/server/lib/auth";
import { getTenant, getTenantId } from "@/server/lib/tenant";

type AgentRequestBody = {
  input?: unknown;
  timezone?: unknown;
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const corsair = await getTenant(session.user.id);
    const tenantId = await getTenantId(session.user.id);

    const now = new Date();

    const result = await runMailPointAgent(
      corsair,
      body.input.trim(),
      {
        timezone,
        currentDateTime: new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: timezone,
        }).format(now),
      },
    );

    const confirmation = result.calendarActionProposal
      ? {
          type: "calendar_event" as const,
          token: await createCalendarConfirmationToken({
            userId: session.user.id,
            tenantId,
            action: result.calendarActionProposal,
          }),
          action: result.calendarActionProposal,
          status: "pending" as const,
        }
      : null;

    return NextResponse.json({
      output: result.finalOutput,
      confirmation,
    });
  } catch (error) {
    console.error("[Agent API]", error);

    if (
      error instanceof Error &&
      error.message.includes("no credits remaining")
    ) {
      return NextResponse.json(
        {
          error: "AI service is temporarily unavailable.",
          code: "AI_CREDITS_EXHAUSTED",
        },
        { status: 503 },
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
