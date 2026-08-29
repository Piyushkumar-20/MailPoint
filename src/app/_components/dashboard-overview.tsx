"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { CalendarDays, Mail, RefreshCw } from "lucide-react";

import {
  formatEventWhen,
  formatMessageDate,
  formatSender,
} from "@/lib/display";
import { getWeekBounds } from "@/lib/week";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type NavigateTarget = "inbox" | "calendar" | "integrations";

function statusLabel(
  state: string | undefined,
  loading: boolean,
  error: boolean,
) {
  if (loading) return "Checking";
  if (error) return "Connection issue";
  if (state === "connected") return "Connected";
  if (state === "missing_credentials") return "Missing credentials";
  return "Not connected";
}

function StatusDot({
  state,
  loading,
  error,
}: {
  state: string | undefined;
  loading: boolean;
  error: boolean;
}) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        loading && "bg-muted-foreground",
        error && "bg-destructive",
        !loading && !error && state === "connected" && "bg-emerald-500",
        !loading && !error && state !== "connected" && "bg-destructive",
      )}
    />
  );
}

function ServiceCard({
  title,
  description,
  icon: Icon,
  state,
  loading,
  error,
  primaryMetric,
  primaryLabel,
  secondaryMetric,
  secondaryLabel,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  state: string | undefined;
  loading: boolean;
  error: boolean;
  primaryMetric: string;
  primaryLabel: string;
  secondaryMetric: string;
  secondaryLabel: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
            <Icon className="size-4" />
          </div>

          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>

        <CardAction>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
            <StatusDot state={state} loading={loading} error={error} />
            {statusLabel(state, loading, error)}
          </span>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3 border-y py-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{primaryMetric}</p>
            <p className="text-muted-foreground text-xs">{primaryLabel}</p>
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{secondaryMetric}</p>
            <p className="text-muted-foreground text-xs">{secondaryLabel}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardOverview({
  userName,
  onNavigate,
}: {
  userName?: string | null;
  onNavigate: (section: NavigateTarget) => void;
}) {
  const week = getWeekBounds(0);

  const [isSyncing, setIsSyncing] = useState(false);

  const connections = api.gmail.checkConnection.useQuery(undefined, {
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });

  const recentMail = api.gmail.searchEmails.useQuery(
    {
      query: "",
      mailbox: "inbox",
      limit: 5,
      offset: 0,
    },
    {
      staleTime: 0,
      refetchOnMount: "always",
      refetchInterval: 60_000,
    },
  );

  const events = api.calendar.searchEvents.useQuery(
    {
      query: "",
      weekStart: week.start.toISOString(),
      weekEnd: week.end.toISOString(),
      limit: 5,
      offset: 0,
    },
    {
      staleTime: 0,
      refetchOnMount: "always",
      refetchInterval: 60_000,
    },
  );

  const connectionStatus = connections.data;
  const gmailState = connectionStatus?.gmail;
  const calendarState = connectionStatus?.googlecalendar;

  const nextEvent = events.data?.[0];
  const greetingName = userName?.split(" ")[0] ?? "there";

  /*
   * TanStack Query updates dataUpdatedAt whenever the query receives
   * fresh data. Taking the newest timestamp gives us the latest
   * successful refresh across Gmail, Calendar and connection status.
   */
  const lastSyncedAt = Math.max(
    connections.dataUpdatedAt,
    recentMail.dataUpdatedAt,
    events.dataUpdatedAt,
  );

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      await Promise.all([
        connections.refetch(),
        recentMail.refetch(),
        events.refetch(),
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  const isLoading =
    connections.isLoading || recentMail.isLoading || events.isLoading;

  const isRefreshing =
    isSyncing ||
    connections.isFetching ||
    recentMail.isFetching ||
    events.isFetching;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      {/* Dashboard Header */}
      <section className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>

          <p className="text-muted-foreground mt-1 text-sm">
            Good day, {greetingName}. Here is what is happening across your
            workspace.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {lastSyncedAt > 0 && (
            <span className="text-muted-foreground hidden text-xs sm:block">
              Last synced{" "}
              {new Date(lastSyncedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleSync}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />

            {isRefreshing ? "Syncing" : "Sync"}
          </Button>
        </div>
      </section>

      {/* Integration Summary */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ServiceCard
          title="Gmail"
          description="Mail workspace"
          icon={Mail}
          state={gmailState}
          loading={connections.isLoading}
          error={Boolean(connections.error ?? recentMail.error)}
          primaryMetric={
            recentMail.isLoading
              ? "Loading"
              : recentMail.data
                ? `${recentMail.data.length} recent`
                : "No data"
          }
          primaryLabel="Available now"
          secondaryMetric={
            recentMail.data?.[0]?.date
              ? formatMessageDate(recentMail.data[0].date)
              : "No recent mail"
          }
          secondaryLabel="Latest email"
          actionLabel="Open Inbox"
          onAction={() => onNavigate("inbox")}
        />

        <ServiceCard
          title="Google Calendar"
          description="Calendar workspace"
          icon={CalendarDays}
          state={calendarState}
          loading={connections.isLoading}
          error={Boolean(connections.error ?? events.error)}
          primaryMetric={
            events.isLoading
              ? "Loading"
              : events.data
                ? `${events.data.length} this week`
                : "No data"
          }
          primaryLabel="Available now"
          secondaryMetric={nextEvent?.summary ?? "No upcoming events"}
          secondaryLabel="Latest event"
          actionLabel="Open Calendar"
          onAction={() => onNavigate("calendar")}
        />
      </section>

      {/* Workspace Details */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Recent Mail */}
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Recent Mail</CardTitle>

            <CardDescription>
              Latest Gmail messages available to MailPoint.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {recentMail.isLoading && <StatusLine>Loading mail...</StatusLine>}

            {recentMail.error && (
              <StatusLine tone="error">{recentMail.error.message}</StatusLine>
            )}

            {recentMail.data && recentMail?.data.length === 0 && (
              <EmptyBlock
                title="No recent mail"
                description="Refresh Gmail from the Inbox when you are connected."
              />
            )}

            {recentMail.data && recentMail.data.length > 0 && (
              <ul className="divide-y">
                {recentMail.data.map((email) => (
                  <li key={email.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => onNavigate("inbox")}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {email.from
                            ? formatSender(email.from)
                            : "Unknown sender"}
                        </span>

                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {email.subject || "(no subject)"}
                        </span>
                      </span>

                      {email.date && (
                        <span className="text-muted-foreground text-xs">
                          {formatMessageDate(email.date)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>

            <CardDescription>This week from Google Calendar.</CardDescription>
          </CardHeader>

          <CardContent>
            {events.isLoading && <StatusLine>Loading events...</StatusLine>}

            {events.error && (
              <StatusLine tone="error">{events.error.message}</StatusLine>
            )}

            {events.data && events.data?.length === 0 && (
              <EmptyBlock
                title="No events this week"
                description="Your calendar is clear in this view."
              />
            )}

            {events.data && events.data.length > 0 && (
              <ul className="divide-y">
                {events.data.slice(0, 5).map((event) => (
                  <li key={event.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => onNavigate("calendar")}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {event.summary || "Untitled"}
                        </span>

                        {event.location && (
                          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                            {event.location}
                          </span>
                        )}
                      </span>

                      <span className="text-muted-foreground text-xs">
                        {formatEventWhen(event.start, event.end)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Integrations */}
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground w-fit"
        onClick={() => onNavigate("integrations")}
      >
        <RefreshCw className="size-3.5" />
        Review integrations
      </Button>
    </div>
  );
}

function StatusLine({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={cn(
        "py-4 text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm font-medium">{title}</p>

      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </div>
  );
}
