import { NextResponse } from "next/server";

import { runMailPointAgent } from "@/server/agent/agent";
import { auth } from "@/server/lib/auth";
import { getTenant, getTenantId } from "@/server/lib/tenant";
import { getEntitlementByTenantId } from "@/server/lib/entitlements";
import { consumeAiRequest, AiDailyQuotaExceededError } from "@/server/lib/ai-usage";
import { createPendingConfirmation } from "@/server/agent/calendar-confirmation";
import type { AgentResponse } from "@/lib/agent-types";

type AgentRequestBody = {
  input?: unknown;
  timezone?: unknown;
  history?: { role: "user" | "assistant"; content: string }[];
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

    // Sanitize history: only accept plain user/assistant text turns
    const history = Array.isArray(body.history)
      ? body.history.filter(
          (h): h is { role: "user" | "assistant"; content: string } =>
            (h.role === "user" || h.role === "assistant") &&
            typeof h.content === "string" &&
            h.content.trim().length > 0,
        )
      : undefined;

    const tenantId = await getTenantId(session.user.id);
    const entitlement = await getEntitlementByTenantId(tenantId);

    if (!entitlement) {
      return NextResponse.json(
        {
          error: "Unable to determine your MailPoint plan.",
          code: "ENTITLEMENT_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    // Free-tier AI requests are metered here, at the user-facing AI entry
    // point. Internal agent turns and tool/MCP calls do not consume extra
    // requests. Pro (aiDailyLimit === null) is not metered by this quota.
    if (entitlement.aiDailyLimit !== null) {
      await consumeAiRequest({
        tenantId,
        timeZone: timezone,
        dailyLimit: entitlement.aiDailyLimit,
      });
    }

    const corsair = await getTenant(session.user.id);

    const result = await runMailPointAgent(
      corsair,
      body.input.trim(),
      {
        timezone,
        currentDateTime: getCurrentDateTime(timezone),
        history,
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
    if (error instanceof AiDailyQuotaExceededError) {
      return NextResponse.json(
        {
          error: "You have reached the Free plan's 10 AI requests per day limit. Upgrade to Pro for unlimited AI requests.",
          code: "AI_DAILY_LIMIT_EXCEEDED",
          usageDate: error.usageDate,
          requestCount: error.requestCount,
          limit: error.limit,
        },
        { status: 429 },
      );
    }

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

