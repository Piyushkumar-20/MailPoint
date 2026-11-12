"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Inbox,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { formatEventWhen } from "@/lib/display";
import { getWeekBounds } from "@/lib/week";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type NavigateTarget = "inbox" | "calendar" | "agent" | "integrations";

function senderLabel(sender: string) {
  const firstSender = sender.split(",").map((part) => part.trim()).find(Boolean) ?? sender;
  const match = /^\s*(.*?)\s*<[^>]+>\s*$/.exec(firstSender);
  const displayName = [match?.[1], firstSender].find(
    (label): label is string => Boolean(label),
  );
  return (displayName ?? firstSender).replace(/^"|"$/g, "").trim();
}

function getInitials(sender: string) {
  const clean = sender.replace(/<[^>]+>/g, "").trim();
  const name = clean.includes("@") ? (clean.split("@")[0] ?? clean) : clean;
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatEmailTime(value: string | null | Date) {
  if (!value) return "";
  const date = value instanceof Date
    ? value
    : /^\d+$/.test(value)
      ? new Date(Number(value))
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function StatusDot({ connected, loading }: { connected: boolean; loading: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-2 rounded-full",
        loading ? "bg-muted-foreground/60" : connected ? "bg-brand" : "bg-destructive",
      )}
      aria-label={loading ? "Checking connection" : connected ? "Connected" : "Not connected"}
    />
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("card-chai min-w-0", className)}>{children}</section>;
}

function PanelHeading({
  icon: Icon,
  title,
  action,
  onAction,
}: {
  icon: typeof Mail;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-[17px] shrink-0 text-muted-foreground" />
        <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
        >
          {action}
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
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
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    updateTime();
    const interval = window.setInterval(updateTime, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const connections = api.gmail.checkConnection.useQuery(undefined, {
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });

  const recentMail = api.gmail.searchEmails.useQuery(
    { query: "", mailbox: "inbox", limit: 5, offset: 0 },
    { staleTime: 0, refetchOnMount: "always", refetchInterval: 60_000 },
  );

  // This is the authoritative Gmail sync state from gmail_sync_state.
  // React Query cache timestamps only tell us when the UI fetched data.
  const gmailSyncStatus = api.gmail.getSyncStatus.useQuery(undefined, {
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.status === "syncing" ||
      query.state.data?.status === "initial_sync_required" ||
      query.state.data?.status === "full_sync_required"
        ? 3_000
        : 30_000,
  });
  const utils = api.useUtils();
  const gmailSync = api.gmail.triggerSync.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gmail.getSyncStatus.invalidate(),
        utils.gmail.searchEmails.invalidate(),
      ]);
    },
    onError: async () => {
      await utils.gmail.getSyncStatus.invalidate();
    },
  });
  const gmailSyncPending = gmailSync.isPending;
  const gmailSyncMutateAsync = gmailSync.mutateAsync;
  const lastAutomaticSyncAttempt = useRef(0);

  const events = api.calendar.searchEvents.useQuery(
    {
      query: "",
      weekStart: week.start.toISOString(),
      weekEnd: week.end.toISOString(),
      limit: 5,
      offset: 0,
    },
    { staleTime: 0, refetchOnMount: "always", refetchInterval: 60_000 },
  );

  const gmailState = connections.data?.gmail;
  const calendarState = connections.data?.googlecalendar;
  const isGmailConnected = gmailState === "connected";
  const isCalendarConnected = calendarState === "connected";
  const greetingName = userName?.trim().split(/\s+/).find(Boolean) ?? "there";
  const hour = currentTime?.getHours();
  const greeting =
    hour === undefined
      ? "Hello"
      : hour >= 5 && hour < 12
        ? "Good morning"
        : hour >= 12 && hour < 17
          ? "Good afternoon"
          : hour >= 17 && hour < 21
            ? "Good evening"
            : "Good night";

  const { upcomingEvents, todayEvents } = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    const allEvents = events.data ?? [];
    return {
      upcomingEvents: allEvents.filter((event) => {
        const start = new Date(event.start).getTime();
        return Number.isFinite(start) && start >= now;
      }),
      todayEvents: allEvents.filter((event) => {
        const start = new Date(event.start);
        return !Number.isNaN(start.getTime()) && start.toDateString() === today;
      }),
    };
  }, [events.data]);

  const nextEvent = upcomingEvents[0];
  const lastSyncedAt = gmailSyncStatus.data?.lastSyncedAt
    ? new Date(gmailSyncStatus.data.lastSyncedAt)
    : null;
  const isRefreshing =
    isSyncing ||
    gmailSyncPending ||
    connections.isFetching ||
    recentMail.isFetching ||
    events.isFetching;

  useEffect(() => {
    const maybeSyncMailbox = () => {
      const state = gmailSyncStatus.data;
      if (!state || !isGmailConnected || gmailSyncPending) return;

      const now = Date.now();
      const lastSyncAge = state.lastSyncedAt
        ? now - new Date(state.lastSyncedAt).getTime()
        : Number.POSITIVE_INFINITY;
      const stateAge = state.updatedAt
        ? now - new Date(state.updatedAt).getTime()
        : Number.POSITIVE_INFINITY;

      const due =
        state.status === "initial_sync_required" ||
        state.status === "full_sync_required" ||
        (state.status === "synced" && lastSyncAge >= 5 * 60_000) ||
        (state.status === "syncing" && stateAge >= 2 * 60_000) ||
        (state.status === "sync_error" && stateAge >= 5 * 60_000);

      if (!due || now - lastAutomaticSyncAttempt.current < 5 * 60_000) return;

      lastAutomaticSyncAttempt.current = now;
      void gmailSyncMutateAsync().catch(() => {
        // The authoritative failure and message are persisted in sync state.
      });
    };

    maybeSyncMailbox();
    const interval = window.setInterval(maybeSyncMailbox, 30_000);
    return () => window.clearInterval(interval);
  }, [
    gmailSyncStatus.data,
    gmailSyncPending,
    gmailSyncMutateAsync,
    isGmailConnected,
  ]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (isGmailConnected) await gmailSync.mutateAsync();
      await Promise.all([
        connections.refetch(),
        recentMail.refetch(),
        events.refetch(),
        gmailSyncStatus.refetch(),
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {currentTime?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) ?? ""}
          </p>
          <h1 className="text-[clamp(1.8rem,3vw,2.55rem)] font-semibold leading-[1.08] tracking-[-0.055em]">
            {greeting}, <span className="highlight">{greetingName}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-[15px]">
            Your email and calendar, in one workspace.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {gmailSyncStatus.data?.status === "sync_error" ? (
            <span
              className="hidden max-w-56 truncate text-[11px] text-destructive sm:block"
              title={gmailSyncStatus.data.lastError ?? "Gmail synchronization failed"}
            >
              Gmail sync issue
            </span>
          ) : lastSyncedAt && !Number.isNaN(lastSyncedAt.getTime()) ? (
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              Last synced{" "}
              {lastSyncedAt.toLocaleDateString() === new Date().toLocaleDateString()
                ? lastSyncedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                : lastSyncedAt.toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSync}
            disabled={isRefreshing}
            className="btn-asym inline-flex h-9 items-center gap-2 border border-border/80 px-3 text-xs font-medium text-foreground transition-colors hover:border-brand/40 hover:bg-white/[0.035] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Syncing" : "Sync workspace"}
          </button>
        </div>
      </section>

      {/* Compact workspace pulse — sourced only from existing Gmail and Calendar queries. */}
      <section className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("inbox")}
          className="card-chai group flex min-h-[108px] items-center gap-4 px-4 py-4 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-white/[0.035] text-brand">
            <Inbox className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Inbox <StatusDot connected={isGmailConnected} loading={connections.isLoading} />
            </span>
            <span className="mt-1 block truncate text-lg font-semibold tracking-tight">
              {recentMail.isLoading ? "Loading" : `${recentMail.data?.length ?? 0} recent messages`}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {isGmailConnected ? "Gmail connected" : connections.isLoading ? "Checking connection" : "Check Gmail connection"}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("calendar")}
          className="card-chai group flex min-h-[108px] items-center gap-4 px-4 py-4 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-white/[0.035] text-brand">
            <CalendarDays className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Calendar <StatusDot connected={isCalendarConnected} loading={connections.isLoading} />
            </span>
            <span className="mt-1 block truncate text-lg font-semibold tracking-tight">
              {events.isLoading ? "Loading schedule" : nextEvent?.summary ?? "No upcoming events"}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {nextEvent ? formatEventWhen(nextEvent.start, nextEvent.end) : isCalendarConnected ? "Your schedule is clear" : "Check Calendar connection"}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("agent")}
          className="card-chai group flex min-h-[108px] items-center gap-4 px-4 py-4 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/[0.07] text-brand">
            <Sparkles className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[11px] text-muted-foreground">MailPoint AI</span>
            <span className="mt-1 block text-lg font-semibold tracking-tight">Your AI workspace</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">Draft, search and organize with AI</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </button>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
        <Panel className="overflow-hidden">
          <PanelHeading icon={Mail} title="Recent emails" action="View inbox" onAction={() => onNavigate("inbox")} />
          <div className="px-3 sm:px-4">
            {recentMail.isLoading && (
              <div className="space-y-4 px-2 py-6">
                {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-white/[0.045]" />)}
              </div>
            )}
            {recentMail.error && (
              <div className="px-3 py-8 text-sm text-destructive">{recentMail.error.message}</div>
            )}
            {recentMail.data?.length === 0 && (
              <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
                <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground"><Mail className="size-4" /></span>
                <p className="text-sm font-medium">Your inbox is quiet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">New messages will appear here when they arrive.</p>
              </div>
            )}
            {recentMail.data && recentMail.data.length > 0 && (
              <ul className="divide-y divide-border/65">
                {recentMail.data.map((email) => (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate("inbox")}
                      className="group grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-4 text-left transition-colors hover:bg-white/[0.025] sm:px-3"
                    >
                      <span className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-white/[0.035] text-[11px] font-semibold text-muted-foreground">
                        {getInitials(email.from || "?")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {email.from ? senderLabel(email.from) : "Unknown sender"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-foreground/85">
                          {email.subject || "(no subject)"}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                          {email.snippet || "No preview available"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 self-start pt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {formatEmailTime(email.date)}
                        <ArrowRight className="size-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/65 px-5 py-3 text-[10px] text-muted-foreground">
            <span>{recentMail.data?.length ?? 0} messages shown</span>
            <span className="inline-flex items-center gap-1.5"><StatusDot connected={isGmailConnected} loading={connections.isLoading} /> Gmail sync</span>
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="overflow-hidden">
            <PanelHeading icon={CalendarDays} title="Today's schedule" action="Open calendar" onAction={() => onNavigate("calendar")} />
            <div className="px-4 py-2">
              {events.isLoading && <p className="px-2 py-8 text-center text-xs text-muted-foreground">Loading your schedule…</p>}
              {events.error && <p className="px-2 py-8 text-center text-xs text-destructive">{events.error.message}</p>}
              {events.data && todayEvents.length === 0 && (
                <div className="flex min-h-44 flex-col items-center justify-center text-center">
                  <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-border bg-white/[0.025] text-muted-foreground"><Check className="size-4" /></span>
                  <p className="text-sm font-semibold">No events today</p>
                  <p className="mt-1 text-xs text-muted-foreground">Your schedule is clear for today.</p>
                </div>
              )}
              {events.data && todayEvents.length > 0 && (
                <ol className="relative ml-2 space-y-1 py-2 before:absolute before:top-5 before:bottom-5 before:left-[5px] before:w-px before:bg-border">
                  {todayEvents.slice(0, 4).map((event, index) => (
                    <li key={event.id} className="relative pl-7">
                      <span className={cn("absolute top-[17px] left-0 z-10 size-[11px] rounded-full border-2 border-background", index === 0 ? "bg-brand" : "bg-muted-foreground/45")} />
                      <button
                        type="button"
                        onClick={() => onNavigate("calendar")}
                        className={cn(
                          "grid w-full gap-1 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/[0.035]",
                          index === 0 && "bg-white/[0.035]",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Clock3 className="size-3" /> {formatEventWhen(event.start, event.end)}
                        </span>
                        <span className="truncate text-[13px] font-semibold">{event.summary || "Untitled event"}</span>
                        {event.location && <span className="truncate text-[11px] text-muted-foreground">{event.location}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Panel>

          <div className="card-chai flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand/25 bg-brand/[0.07] text-brand"><Sparkles className="size-4" /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">Need a hand?</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Ask MailPoint AI to help with your day.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("agent")}
              className="btn-asym inline-flex h-8 shrink-0 items-center gap-1.5 border border-border/80 px-3 text-[11px] font-semibold transition-colors hover:border-brand/40 hover:text-brand"
            >
              Open assistant <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => onNavigate("integrations")}
        className="inline-flex w-fit items-center gap-2 text-[11px] text-muted-foreground transition-colors hover:text-brand"
      >
        <RefreshCw className="size-3" /> Review connected services
      </button>
    </div>
  );
}
