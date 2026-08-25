"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MapPin, RefreshCw, Search, Users } from "lucide-react";

import {
  formatAttendees,
  formatEventWhen,
  LinkifiedText,
} from "@/lib/display";
import { cn } from "@/lib/utils";
import { getWeekBounds } from "@/lib/week";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  location: string;
  status: string;
  start: string;
  end: string;
  attendees: string[];
  htmlLink: string;
};

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toDateString();
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupEventsByDay(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.start);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: dayLabel(items[0]?.start ?? ""),
    events: items,
  }));
}

export function CalendarPanel({
  weekOffset,
  focusCreateSignal,
}: {
  /** Which week to show, relative to the current week (0 = this week). Controlled by the header nav. */
  weekOffset: number;
  /** Bump this number to open the create-event sheet from the header button. */
  focusCreateSignal: number;
}) {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);

  const defaultStart = new Date();
  defaultStart.setMinutes(0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(defaultEnd.getHours() + 1);

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState(toDatetimeLocalValue(defaultStart));
  const [end, setEnd] = useState(toDatetimeLocalValue(defaultEnd));
  const [attendees, setAttendees] = useState("");

  useEffect(() => {
    if (focusCreateSignal > 0) {
      setCreateOpen(true);
    }
  }, [focusCreateSignal]);

  const utils = api.useUtils();

  const events = api.calendar.searchEvents.useQuery({
    query: activeSearch,
    weekStart: week.start.toISOString(),
    weekEnd: week.end.toISOString(),
    limit: 50,
    offset: 0,
  });

  const refreshEvents = api.calendar.refreshEvents.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
    },
  });

  const createDraft = api.calendar.createDraft.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
      resetForm();
      setCreateOpen(false);
    },
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
      resetForm();
      setCreateOpen(false);
    },
  });

  function resetForm() {
    setSummary("");
    setDescription("");
    setLocation("");
    setAttendees("");
  }

  function parseAttendees() {
    return attendees
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  }

  function toIso(datetimeLocal: string) {
    return new Date(datetimeLocal).toISOString();
  }

  const eventInput = {
    summary,
    description: description || undefined,
    location: location || undefined,
    start: toIso(start),
    end: toIso(end),
    attendees: parseAttendees(),
  };

  const groupedEvents = groupEventsByDay(events.data ?? []);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">Calendar</h2>
            <p className="text-xs text-muted-foreground">
              {week.start.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              -{" "}
              {week.end.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                refreshEvents.mutate({
                  weekStart: week.start.toISOString(),
                  weekEnd: week.end.toISOString(),
                })
              }
              disabled={refreshEvents.isPending}
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  refreshEvents.isPending && "animate-spin",
                )}
              />
              <span className="hidden sm:inline">
                {refreshEvents.isPending ? "Refreshing" : "Refresh"}
              </span>
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" />
              Create
            </Button>
          </div>
        </div>

        {(refreshEvents.data || refreshEvents.error) && (
          <div className="border-b px-4 py-2 text-xs">
            {refreshEvents.error && (
              <p className="text-destructive">{refreshEvents.error.message}</p>
            )}
            {refreshEvents.data && (
              <p className="text-muted-foreground">
                {refreshEvents.data.synced} synced from Google Calendar
              </p>
            )}
          </div>
        )}

        <div className="border-b px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveSearch(search);
            }}
            className="flex max-w-xl items-center gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {activeSearch && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setActiveSearch("");
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-4">
          {events.isLoading && <StatusLine>Loading events...</StatusLine>}
          {events.error && (
            <StatusLine tone="error">{events.error.message}</StatusLine>
          )}

          {events.data && (
            <>
              {events.data.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-background py-14 text-center">
                  <p className="text-sm font-medium">No events this week</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your agenda is clear in this view.
                  </p>
                </div>
              ) : (
                <div className="mx-auto flex max-w-5xl flex-col gap-5">
                  {groupedEvents.map((group) => (
                    <section
                      key={group.key}
                      className="grid gap-3 md:grid-cols-[180px_1fr]"
                    >
                      <div>
                        <h3 className="font-heading text-sm font-semibold">
                          {group.label}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {group.events.length} event
                          {group.events.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {group.events.map((event) => (
                          <EventRow key={event.id} event={event} />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Create event</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
            <Input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Title"
              autoFocus
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={4}
              className="resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Start
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                End
                <Input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <Input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Attendees (comma-separated)"
            />

            {(createDraft.error ?? sendInvite.error) && (
              <p className="text-sm text-destructive">
                {(createDraft.error ?? sendInvite.error)?.message}
              </p>
            )}
          </div>

          <SheetFooter className="border-t sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => createDraft.mutate(eventInput)}
              disabled={createDraft.isPending || !summary || !start || !end}
            >
              {createDraft.isPending ? "Saving" : "Save draft"}
            </Button>
            <Button
              type="button"
              onClick={() => sendInvite.mutate(eventInput)}
              disabled={
                sendInvite.isPending ||
                !summary ||
                !start ||
                !end ||
                parseAttendees().length === 0
              }
            >
              {sendInvite.isPending ? "Sending" : "Send invite"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="group rounded-lg border bg-background p-4 transition-colors hover:bg-card">
      <div className="flex gap-3">
        <div className="mt-1 h-10 w-1 shrink-0 rounded-full bg-primary/70" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {event.htmlLink ? (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-semibold hover:text-primary"
              >
                {event.summary || "Untitled"}
              </a>
            ) : (
              <span className="truncate text-sm font-semibold">
                {event.summary || "Untitled"}
              </span>
            )}
            {event.start && (
              <span className="text-xs font-medium text-muted-foreground">
                {formatEventWhen(event.start, event.end)}
              </span>
            )}
          </div>

          {event.location && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </p>
          )}
          {event.description && (
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              <LinkifiedText text={event.description} />
            </p>
          )}
          {event.attendees.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{formatAttendees(event.attendees)}</span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusLine({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={cn(
        "px-4 py-4 text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
