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
  section = "settings",
}: {
  user: { name?: string | null; email?: string | null } | null;
  section?: "settings" | "integrations";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <OAuthCallbackHandler onResult={handleCallbackResult} />
      </Suspense>

      <header className="flex flex-col gap-2 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Workspace preferences
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {section === "integrations" ? "Integrations" : "Settings"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {section === "integrations"
              ? "Connect and manage the services that power your MailPoint workspace."
              : "Manage your MailPoint account, connected services, and subscription in one place."}
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-brand" />
          Workspace settings
        </div>
      </header>

      <section aria-labelledby="account-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="account-heading" className="font-heading text-lg font-semibold tracking-tight">Account</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Your MailPoint sign-in details.</p>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">Personal profile</span>
        </div>

        <Card className="overflow-hidden border-[var(--card-edge)] bg-[var(--card-fill)] shadow-none">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-base font-semibold text-highlight">
              {(user?.name?.trim()?.[0] || user?.email?.trim()?.[0] || "M").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user?.name ?? "MailPoint user"}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{user?.email ?? "No email available"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm sm:min-w-[260px] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                <p className="mt-1 font-medium">MailPoint</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sign-in</p>
                <p className="mt-1 font-medium">Google</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="google-heading" className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="google-heading" className="font-heading text-lg font-semibold tracking-tight">Connected services</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage the Google services MailPoint uses to power your workspace.</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Checking connections…" : bothConnected ? "2 of 2 services connected" : `${Number(gmailConnected) + Number(calendarConnected)} of 2 services connected`}
          </span>
        </div>

        {(callbackStatus === "error" || disconnectError) && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive" role="alert">
            {disconnectError ?? "Google authorization failed. Please try again."}
          </div>
        )}
        {callbackStatus === "success" && callbackPlugin && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {callbackPlugin === "gmail" ? "Gmail connected successfully." : callbackPlugin === "googlecalendar" ? "Google Calendar connected successfully." : "Google connected successfully."}
          </div>
        )}

        <Card className="overflow-hidden border-[var(--card-edge)] bg-[var(--card-fill)] shadow-none">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-5" aria-hidden="true">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.2 33.6 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l6.3-6.3C34.7 5.6 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.5-4z" />
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.2 19.2 13 24 13c3.1 0 5.8 1.1 7.9 2.9l6.3-6.3C34.7 5.6 29.6 3.5 24 3.5c-7.8 0-14.4 4.7-17.7 11.2z" />
                <path fill="#FBBC05" d="M24 44.5c5.5 0 10.5-2 14.3-5.3l-6.6-5.6C29.7 35.4 27 36 24 36c-5.6 0-10.1-3.4-11.6-8.3l-7 5.4C8.6 40.2 15.7 44.5 24 44.5z" />
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.3-2.2 4.2-4.2 5.6l6.6 5.6c3.8-3.5 6.4-8.7 6.4-15.2 0-1.4-.1-2.7-.5-4z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Google account</CardTitle>
              <CardDescription className="mt-0.5">
                {bothConnected ? "Your Google services are ready to use in MailPoint." : anyConnected ? "One service is connected. Finish setup to enable the full workspace." : "Connect Google to use Gmail and Google Calendar in MailPoint."}
              </CardDescription>
            </div>
            <span className={cn("hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex", bothConnected ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/50 text-muted-foreground")}>
              <span className={cn("size-1.5 rounded-full", bothConnected ? "bg-emerald-500" : "bg-muted-foreground/60")} />
              {bothConnected ? "All connected" : "Setup required"}
            </span>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70"><Mail className="size-4 text-muted-foreground" /></div>
                  <div className="min-w-0"><p className="text-sm font-medium">Gmail</p><p className="text-xs text-muted-foreground">Email and inbox access</p></div>
                </div>
                <StatusBadge state={gmailState} loading={isLoading} error={hasError} />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70"><CalendarDays className="size-4 text-muted-foreground" /></div>
                  <div className="min-w-0"><p className="text-sm font-medium">Google Calendar</p><p className="text-xs text-muted-foreground">Events and availability</p></div>
                </div>
                <StatusBadge state={calendarState} loading={isLoading} error={hasError} />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                {!gmailConnected && !calendarConnected && <ConnectButton plugin="gmail" label="Connect Google" disabled={isLoading} />}
                {!gmailConnected && calendarConnected && <ConnectButton plugin="gmail" label="Connect Gmail" disabled={isLoading} />}
                {gmailConnected && !calendarConnected && <>
                  <ConnectButton plugin="googlecalendar" label="Connect Google Calendar" disabled={isLoading} />
                  <ConnectButton plugin="gmail" label="Reconnect Gmail" variant="outline" disabled={isLoading} />
                </>}
                {bothConnected && !confirmDisconnect && <ConnectButton plugin="gmail" label="Reconnect Google" variant="outline" disabled={disconnectMutation.isPending || isLoading} />}
                {bothConnected && !confirmDisconnect && <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDisconnectError(null); setConfirmDisconnect(true); }} disabled={disconnectMutation.isPending || isLoading}>Disconnect</Button>}
              </div>
              {confirmDisconnect && (
                <div className="flex flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center sm:justify-end">
                  <p className="text-xs text-muted-foreground">Disconnect Google? Gmail and Calendar will stop working until reconnected.</p>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="destructive" onClick={() => { setDisconnectError(null); disconnectMutation.mutate(); }} disabled={disconnectMutation.isPending}>
                      {disconnectMutation.isPending && <RefreshCw className="mr-1.5 size-3.5 animate-spin" />}
                      Confirm
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setConfirmDisconnect(false); setDisconnectError(null); }} disabled={disconnectMutation.isPending}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <PlanBillingSection user={user} />
    </div>
  );
}
