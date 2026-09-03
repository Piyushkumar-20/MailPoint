import { NextResponse } from "next/server";
import { auth } from "@/server/lib/auth";
import { getTenantId } from "@/server/lib/tenant";
import { corsair } from "@/server/corsair";
import { confirmRequestSchema } from "@/lib/agent-types";
import {
  confirmCalendarEvent,
  cancelCalendarEvent,
} from "@/server/agent/calendar-confirmation";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json: unknown = await request.json();
    const parsed = confirmRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid confirmation request body." },
        { status: 400 },
      );
    }

    const { token, action } = parsed.data;
    const userId = session.user.id;
    const tenantId = await getTenantId(userId);

    if (action === "cancel") {
      const cancelResult = await cancelCalendarEvent(token, userId);
      if (!cancelResult.success) {
        return NextResponse.json(
          {
            success: false,
            status: "error",
            message: cancelResult.error ?? "Failed to cancel event proposal.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        status: "cancelled",
        message: "Calendar event proposal was cancelled.",
      });
    }

    // action === "confirm"
    const result = await confirmCalendarEvent(
      corsair,
      token,
      userId,
      tenantId,
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          message: result.error ?? "Failed to create calendar event.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      status: "confirmed",
      message: result.message ?? "Calendar event scheduled successfully!",
      event: result.event,
      emailResult: result.emailResult,
    });
  } catch (error: unknown) {
    console.error("[Agent Confirm API]", error);
    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: "Failed to process confirmation. Please try again.",
      },
      { status: 500 },
    );
  }
}
