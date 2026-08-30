import { NextResponse } from "next/server";

import { runMailPointAgent } from "@/server/agent/agent";
import { auth } from "@/server/lib/auth";
import { getTenant } from "@/server/lib/tenant";

type AgentRequestBody = {
  input?: unknown;
};

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

    const corsair = await getTenant(session.user.id);

    const result = await runMailPointAgent(
      corsair,
      body.input.trim(),
    );

    return NextResponse.json({
      output: result.finalOutput,
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