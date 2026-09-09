"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Mail, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlanBillingSection } from "@/app/_components/plan-billing-section";

// ---------------------------------------------------------------------------
// Architecture note
// ---------------------------------------------------------------------------
// Gmail and Google Calendar are INDEPENDENT OAuth connections in Corsair.
// Each plugin has its own corsair_accounts row and separate OAuth tokens.
//   Gmail scopes:    gmail.modify / gmail.labels / gmail.send / gmail.compose
//   Calendar scopes: calendar  (completely separate scope)
// The /api/corsair/connect?plugin=<id> endpoint accepts "gmail" or
// "googlecalendar" and starts an independent OAuth flow for each.
// After the callback the user lands back at /settings/integrations with:
//   ?connection=success&plugin=<pluginId>   or   ?connection=error
// We read those params to immediately refetch status and avoid stale state.
// ---------------------------------------------------------------------------

type PluginKey = "gmail" | "googlecalendar";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function statusCopy(
  state: string | undefined,
  loading: boolean,
  error: boolean,
) {
  if (loading) return "Checking\u2026";
  if (error) return "Connection issue";
  if (state === "connected") return "Connected";
  if (state === "missing_credentials") return "Missing credentials";
  return "Not connected";
}

function statusTone(
  state: string | undefined,
  loading: boolean,
  error: boolean,
) {
  if (loading) return "neutral" as const;
  if (error || state !== "connected") return "error" as const;
  return "success" as const;
}

function StatusBadge({
  state,
  loading,
  error,
}: {
  state: string | undefined;
  loading: boolean;
  error: boolean;
}) {
  const tone = statusTone(state, loading, error);

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
      <span
        className={cn(
          "size-2 rounded-full",
          tone === "success" && "bg-emerald-500",
          tone === "error" && "bg-destructive",
          tone === "neutral" && "bg-muted-foreground",
        )}
      />
      {statusCopy(state, loading, error)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// service row
// ---------------------------------------------------------------------------

function ServiceRow({
  icon: Icon,
  label,
  state,
  loading,
  error,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  state: string | undefined;
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <StatusBadge state={state} loading={loading} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// single connect / reconnect button
// ---------------------------------------------------------------------------

function ConnectButton({
  plugin,
  label,
  variant,
  disabled,
}: {
  plugin: PluginKey;
  label: string;
  variant?: "default" | "outline";
  disabled?: boolean;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setError(null);
      setIsConnecting(true);

      const response = await fetch(
        `/api/corsair/connect?plugin=${encodeURIComponent(plugin)}`,
        { method: "GET", credentials: "include" },
      );

      if (!response.ok) throw new Error("Failed to create connection");

      const data = (await response.json()) as { connectUrl?: string };
      if (!data.connectUrl)
        throw new Error("Corsair did not return a connection URL");

      window.location.href = data.connectUrl;
    } catch (err) {
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={variant ?? "default"}
        onClick={handleConnect}
        disabled={disabled ?? isConnecting}
      >
        {isConnecting && (
          <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
        )}
        {label}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// callback-param reader — must live inside <Suspense> because useSearchParams
// throws during SSR without a boundary.
// ---------------------------------------------------------------------------

function OAuthCallbackHandler({
  onResult,
}: {
  onResult: (status: string | null, plugin: string | null) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onResult(
      searchParams.get("connection"),
      searchParams.get("plugin"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

// ---------------------------------------------------------------------------
// main panel
// ---------------------------------------------------------------------------

export function IntegrationsPanel({
  user,
}: {
  user: { name?: string | null; email?: string | null } | null;
}) {
  const utils = api.useUtils();

  const connections = api.gmail.checkConnection.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [callbackStatus, setCallbackStatus] = useState<string | null>(null);
  const [callbackPlugin, setCallbackPlugin] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Called by OAuthCallbackHandler once the search params are known.
  const handleCallbackResult = (
    status: string | null,
    plugin: string | null,
  ) => {
    setCallbackStatus(status);
    setCallbackPlugin(plugin);
    if (status === "success") {
      void utils.gmail.checkConnection.invalidate();
    }
  };

  const gmailState = connections.data?.gmail;
  const calendarState = connections.data?.googlecalendar;
  const gmailConnected = gmailState === "connected";
  const calendarConnected = calendarState === "connected";
  const bothConnected = gmailConnected && calendarConnected;
  const anyConnected = gmailConnected || calendarConnected;

  const isLoading = connections.isLoading;
  const hasError = Boolean(connections.error);

  // ── disconnect ─────────────────────────────────────────────────────────────

  const disconnectMutation = api.integrations.disconnectGoogle.useMutation({
    onSuccess: async () => {
      setConfirmDisconnect(false);
      setDisconnectError(null);
      await utils.gmail.checkConnection.invalidate();
    },
    onError: (err) => {
      setDisconnectError(err.message ?? "Failed to disconnect Google");
    },
  });

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-6 md:px-6">
      {/* reads ?connection and ?plugin from URL — needs Suspense */}
      <Suspense fallback={null}>
        <OAuthCallbackHandler onResult={handleCallbackResult} />
      </Suspense>

      {/* ── Page heading ── */}
      <section>
        <h1 className="font-heading text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account, connected services, and subscription.
        </p>
      </section>

      {/* ── Account section ── */}
      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="font-heading text-2xl font-semibold">
          Account
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Your MailPoint account information.
        </p>

        <Card className="mt-4">
          <CardContent className="pt-4">
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground shrink-0">Name</dt>
                <dd className="text-right font-medium">{user?.name ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground shrink-0">Email</dt>
                <dd className="truncate text-right font-medium">
                  {user?.email ?? "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* ── Google section ── */}
      <section aria-labelledby="google-heading">
        <h2 id="google-heading" className="font-heading text-2xl font-semibold">
          Google
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Review the Google services available inside your MailPoint workspace.
        </p>

        {/* OAuth callback result banner */}
        {callbackStatus === "error" && (
          <p className="text-destructive mt-3 text-sm">
            Google authorization failed. Please try again.
          </p>
        )}
        {callbackStatus === "success" && callbackPlugin && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
            {callbackPlugin === "gmail"
              ? "Gmail connected successfully."
              : callbackPlugin === "googlecalendar"
                ? "Google Calendar connected successfully."
                : "Google connected successfully."}
          </p>
        )}

        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              {/* Google G mark */}
              <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="size-5"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M44.5 20H24v8.5h11.7C34.2 33.6 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l6.3-6.3C34.7 5.6 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.5-4z"
                  />
                  <path
                    fill="#34A853"
                    d="M6.3 14.7l7 5.1C15 16.2 19.2 13 24 13c3.1 0 5.8 1.1 7.9 2.9l6.3-6.3C34.7 5.6 29.6 3.5 24 3.5c-7.8 0-14.4 4.7-17.7 11.2z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M24 44.5c5.5 0 10.5-2 14.3-5.3l-6.6-5.6C29.7 35.4 27 36 24 36c-5.6 0-10.1-3.4-11.6-8.3l-7 5.4C8.6 40.2 15.7 44.5 24 44.5z"
                  />
                  <path
                    fill="#EA4335"
                    d="M44.5 20H24v8.5h11.7c-.8 2.3-2.2 4.2-4.2 5.6l6.6 5.6c3.8-3.5 6.4-8.7 6.4-15.2 0-1.4-.1-2.7-.5-4z"
                  />
                </svg>
              </div>

              <div>
                <CardTitle>Google</CardTitle>
                <CardDescription>
                  {bothConnected
                    ? "Your Google account is connected to MailPoint. MailPoint can access Gmail and Google Calendar."
                    : anyConnected
                      ? "Partially connected. Authorize the remaining Google service below."
                      : "Connect your Google account to enable Gmail and Google Calendar inside MailPoint."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* per-service status rows */}
            <div className="divide-y rounded-md border px-4">
              <ServiceRow
                icon={Mail}
                label="Gmail"
                state={gmailState}
                loading={isLoading}
                error={hasError}
              />
              <ServiceRow
                icon={CalendarDays}
                label="Google Calendar"
                state={calendarState}
                loading={isLoading}
                error={hasError}
              />
            </div>

            {/* action buttons — reflect the actual backend connection state */}
            {!confirmDisconnect ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* Neither connected → single "Connect Google" button.
                    Connecting Gmail is the first step; Calendar is separately
                    authorized after. */}
                {!gmailConnected && !calendarConnected && (
                  <ConnectButton
                    plugin="gmail"
                    label="Connect Google"
                    variant="default"
                    disabled={isLoading}
                  />
                )}

                {/* Calendar connected but Gmail is not */}
                {!gmailConnected && calendarConnected && (
                  <ConnectButton
                    plugin="gmail"
                    label="Connect Gmail"
                    variant="default"
                    disabled={isLoading}
                  />
                )}

                {/* Gmail connected but Calendar is not — show both connect and
                    reconnect so the user can fix either service independently */}
                {gmailConnected && !calendarConnected && (
                  <>
                    <ConnectButton
                      plugin="googlecalendar"
                      label="Connect Google Calendar"
                      variant="default"
                      disabled={isLoading}
                    />
                    <ConnectButton
                      plugin="gmail"
                      label="Reconnect Gmail"
                      variant="outline"
                      disabled={isLoading}
                    />
                  </>
                )}

                {/* Both connected — show reconnect (re-auth) and disconnect */}
                {bothConnected && (
                  <>
                    <ConnectButton
                      plugin="gmail"
                      label="Reconnect Google"
                      variant="outline"
                      disabled={disconnectMutation.isPending || isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setDisconnectError(null);
                        setConfirmDisconnect(true);
                      }}
                      disabled={disconnectMutation.isPending || isLoading}
                    >
                      Disconnect Google
                    </Button>
                  </>
                )}
              </div>
            ) : (
              /* inline confirmation */
              <div className="bg-destructive/5 border-destructive/20 space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">Disconnect Google?</p>
                <p className="text-muted-foreground text-sm">
                  This will remove your Google account from MailPoint. Gmail and
                  Google Calendar will stop working until you reconnect. Your
                  Google account and data will not be affected.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDisconnectError(null);
                      disconnectMutation.mutate();
                    }}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending && (
                      <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                    )}
                    Yes, disconnect
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfirmDisconnect(false);
                      setDisconnectError(null);
                    }}
                    disabled={disconnectMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
                {disconnectError && (
                  <p className="text-destructive text-xs">{disconnectError}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Plan & Billing section ── */}
      <PlanBillingSection user={user} />
    </div>
  );
}
