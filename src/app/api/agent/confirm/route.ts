import { NextResponse } from "next/server";
import { z } from "zod";
import { executePermission } from "corsair";

import {
  consumeCalendarConfirmationToken,
  deleteCalendarConfirmationToken,
  updateCalendarConfirmationApproval,
} from "@/server/agent/calendar-confirmation";
import { corsair } from "@/server/corsair";
import { auth } from "@/server/lib/auth";
import { getTenant, getTenantId } from "@/server/lib/tenant";

const confirmRequestBodySchema = z.object({
  token: z.unknown().optional(),
});

const calendarActionSchema = z.object({
  type: z.literal("calendar_event"),
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  attendees: z.array(z.string()),
});

type CalendarAction = z.infer<typeof calendarActionSchema>;

type ConfirmationPayload = {
  userId: string;
  tenantId: string;
  action: CalendarAction;
  corsairPermissionToken?: string;
  approvalUrl?: string;
};

type ConfirmationOk = {
  status: "ok";
  payload: ConfirmationPayload;
};

function extractCorsairApprovalUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";

  const approvalUrlMatch = /https:\/\/hub\.corsair\.dev\/approve\/\S+/i.exec(
    message,
  );

  if (!approvalUrlMatch?.[0]) {
    return null;
  }

  return approvalUrlMatch[0].replace(/[),.]+$/, "");
}

const confirmationCookieName = "mailpoint_calendar_confirmation";

function setConfirmationCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: confirmationCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
}

function isApprovalRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("approval required")
  );
}

function getCalendarEvent(result: unknown): {
  id: string;
  htmlLink: string;
} | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }

  const record = result as Record<string, unknown>;

  const id = typeof record.id === "string" ? record.id : "";

  const htmlLink = typeof record.htmlLink === "string" ? record.htmlLink : "";

  return id ? { id, htmlLink } : null;
}

function isConfirmationOk(value: unknown): value is ConfirmationOk {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.status === "ok" &&
    typeof record.payload === "object" &&
    record.payload !== null
  );
}

function getConfirmationPayload(
  confirmation: ConfirmationOk,
): ConfirmationPayload | null {
  const record = confirmation.payload as Record<string, unknown>;

  const actionResult = calendarActionSchema.safeParse(record.action);

  const userId = typeof record.userId === "string" ? record.userId : "";

  const tenantId = typeof record.tenantId === "string" ? record.tenantId : "";

  const corsairPermissionToken =
    typeof record.corsairPermissionToken === "string"
      ? record.corsairPermissionToken
      : undefined;

  const approvalUrl =
    typeof record.approvalUrl === "string" ? record.approvalUrl : undefined;

  if (!userId || !tenantId || !actionResult.success) {
    return null;
  }

  return {
    userId,
    tenantId,
    action: actionResult.data,
    corsairPermissionToken,
    approvalUrl,
  };
}

type PermissionExecutorCorsair = Parameters<typeof executePermission>[0];

const permissionExecutorCorsair =
  corsair as unknown as PermissionExecutorCorsair;

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = confirmRequestBodySchema.parse(await request.json());

    if (typeof body.token !== "string" || !body.token.trim()) {
      return NextResponse.json(
        {
          error: "confirmation token is required",
        },
        { status: 400 },
      );
    }

    const confirmationToken = body.token.trim();

    const consumed = await consumeCalendarConfirmationToken({
      userId: session.user.id,
      token: confirmationToken,
    });

    if (!("payload" in consumed)) {
      if (consumed.status === "expired") {
        return NextResponse.json(
          {
            error: "Confirmation token expired.",
          },
          { status: 410 },
        );
      }

      if (consumed.status === "unauthorized") {
        return NextResponse.json(
          {
            error: "Unauthorized confirmation token.",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error: "Confirmation token is invalid or expired.",
        },
        { status: 409 },
      );
    }

    if (!isConfirmationOk(consumed)) {
      return NextResponse.json(
        {
          error: "Confirmation token is invalid.",
        },
        { status: 409 },
      );
    }

    const payload = getConfirmationPayload(consumed);

    if (!payload) {
      return NextResponse.json(
        {
          error: "Confirmation payload is invalid.",
        },
        { status: 409 },
      );
    }

    const tenantId = await getTenantId(session.user.id);

    if (payload.userId !== session.user.id || payload.tenantId !== tenantId) {
      return NextResponse.json(
        {
          error: "Unauthorized confirmation token.",
        },
        { status: 403 },
      );
    }

    /*
     * If Corsair already created a permission,
     * execute the exact frozen operation after
     * the user has approved it in Corsair Hub.
     */
    if (!payload.corsairPermissionToken && payload.approvalUrl) {
      return NextResponse.json(
        {
          error:
            "Corsair approval has not been linked to this confirmation yet. Complete the approval and retry.",
          approvalUrl: payload.approvalUrl,
        },
        { status: 409 },
      );
    }

    if (payload.corsairPermissionToken) {
      const permissionResult = await executePermission(
        permissionExecutorCorsair,
        payload.corsairPermissionToken,
      );

      if (permissionResult.error) {
        return NextResponse.json(
          {
            error: permissionResult.error,
          },
          { status: 409 },
        );
      }

      const event = getCalendarEvent(permissionResult.result);

      if (!event) {
        console.error(
          "[Agent Confirm API] Corsair permission completed without a usable calendar event.",
          permissionResult,
        );

        return NextResponse.json(
          {
            error: "Calendar action completed without a usable event result.",
          },
          { status: 502 },
        );
      }

      await deleteCalendarConfirmationToken({
        userId: session.user.id,
        token: confirmationToken,
      });

      const response = NextResponse.json({
        status: "confirmed",
        output: "Calendar event created.",
        event,
      });

      response.cookies.delete(confirmationCookieName);

      return response;
    }

    const tenant = await getTenant(session.user.id);

    const action = payload.action;

    try {
      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "all",
        event: {
          summary: action.summary,
          start: {
            dateTime: action.start,
          },
          end: {
            dateTime: action.end,
          },
          attendees: action.attendees.map((email: string) => ({
            email,
          })),
        },
      });

      const eventId = typeof event.id === "string" ? event.id : "";

      if (!eventId) {
        return NextResponse.json(
          {
            error: "Calendar action completed without an event ID.",
          },
          { status: 502 },
        );
      }

      await deleteCalendarConfirmationToken({
        userId: session.user.id,
        token: confirmationToken,
      });

      const response = NextResponse.json({
        status: "confirmed",
        output: "Calendar event created.",
        event: {
          id: eventId,
          htmlLink: typeof event.htmlLink === "string" ? event.htmlLink : "",
        },
      });

      response.cookies.delete(confirmationCookieName);

      return response;
    } catch (error) {
      if (!isApprovalRequiredError(error)) {
        throw error;
      }

      const approvalUrl = extractCorsairApprovalUrl(error);

      if (!approvalUrl) {
        console.error(
          "[Agent Confirm API] Corsair requested approval but did not expose an approval URL.",
          error,
        );

        return NextResponse.json(
          {
            error:
              "Calendar action requires Corsair approval, but MailPoint could not obtain the approval link.",
          },
          { status: 502 },
        );
      }
      const updated = await updateCalendarConfirmationApproval({
        userId: session.user.id,
        token: confirmationToken,
        corsairPermissionToken: "",
        approvalUrl,
      });

      if (updated.status !== "ok") {
        return NextResponse.json(
          {
            error: "Calendar confirmation could not be updated.",
          },
          { status: 409 },
        );
      }

      const response = NextResponse.json(
        {
          status: "approval_required",
          output:
            "Calendar approval is required. Approve the action in Corsair, then retry the confirmation in MailPoint.",
          approvalUrl,
        },
        { status: 202 },
      );
      setConfirmationCookie(response, confirmationToken);

      return response;
    }
  } catch (error) {
    console.error("[Agent Confirm API]", error);

    return NextResponse.json(
      {
        error: "Failed to confirm calendar action.",
      },
      { status: 502 },
    );
  }
}
