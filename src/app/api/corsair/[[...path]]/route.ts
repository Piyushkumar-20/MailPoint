import { toNextJsHandler } from "corsair";

import { updateCalendarConfirmationApproval } from "@/server/agent/calendar-confirmation";
import { auth } from "@/server/lib/auth";
import { getTenantId } from "@/server/lib/tenant";
import { corsair } from "@/server/corsair";

const corsairHandler = toNextJsHandler(corsair, {
  basePath: "/api/corsair",
});

const confirmationCookieName = "mailpoint_calendar_confirmation";

type PermissionCallback = {
  deliveryMode?: unknown;
  permissionToken?: unknown;
  tenantId?: unknown;
  plugin?: unknown;
  exp?: unknown;
};

function decodeCallbackPayload(value: string): PermissionCallback | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isPermissionCallback(
  payload: PermissionCallback | null,
): payload is PermissionCallback & {
  deliveryMode: "permission.approve";
  permissionToken: string;
  tenantId: string;
} {
  return (
    payload?.deliveryMode === "permission.approve" &&
    typeof payload.permissionToken === "string" &&
    payload.permissionToken.length > 0 &&
    typeof payload.tenantId === "string" &&
    payload.tenantId.length > 0
  );
}

async function captureApprovedPermission(request: Request) {
  const url = new URL(request.url);
  const encodedPayload = url.searchParams.get("d");

  if (!encodedPayload) {
    return;
  }

  const response = await corsairHandler.GET(request);

  if (!response.ok && response.status < 300) {
    return response;
  }

  const callback = decodeCallbackPayload(encodedPayload);

  if (!isPermissionCallback(callback)) {
    return response;
  }

  const confirmationToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${confirmationCookieName}=`))
    ?.slice(confirmationCookieName.length + 1);

  if (!confirmationToken) {
    return response;
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return response;
  }

  const tenantId = await getTenantId(session.user.id);

  /*
   * Never attach a Corsair permission belonging to another tenant.
   */
  if (callback.tenantId !== tenantId) {
    console.error(
      "[Corsair Callback] Ignoring permission callback for a different tenant.",
    );
    return response;
  }

  if (callback.plugin !== undefined && callback.plugin !== "googlecalendar") {
    return response;
  }

  const updated = await updateCalendarConfirmationApproval({
    userId: session.user.id,
    token: confirmationToken,
    corsairPermissionToken: callback.permissionToken,
    approvalUrl: url.toString(),
  });

  if (updated.status !== "ok") {
    console.error(
      "[Corsair Callback] Could not attach permission token to MailPoint confirmation.",
      updated,
    );
  }

  return response;
}

export async function GET(request: Request) {
  try {
    return await captureApprovedPermission(request);
  } catch (error) {
    console.error("[Corsair Callback]", error);

    /*
     * Preserve Corsair's normal callback behavior even if the MailPoint
     * correlation step fails.
     */
    return corsairHandler.GET(request);
  }
}

export const POST = corsairHandler.POST;
export const OPTIONS = corsairHandler.OPTIONS;
