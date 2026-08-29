"use client";

import {
  CalendarPlus,
  Mail,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatAttendees, formatEventWhen, LinkifiedText } from "@/lib/display";
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

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDatetimeLocalFromIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return toDatetimeLocalValue(date);
}

export type CalendarEvent = {
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

function extractAttendeeEmails(attendees: string[]) {
  return attendees
    .map((attendee) => {
      const emailMatch = /<([^>]+)>/.exec(attendee);

      return emailMatch?.[1] ?? attendee;
    })
    .map((email) => email.trim())
    .filter(Boolean);
}

export function CalendarPanel({
  weekOffset,
  focusCreateSignal,
  onEmailAttendees,
}: {
  /** Which week to show, relative to the current week (0 = this week). Controlled by the header nav. */
  weekOffset: number;
  /** Bump this number to open the create-event sheet from the header button. */
  focusCreateSignal: number;
  /** Opens the Gmail composer with the event attendees and context. */
  onEmailAttendees: (event: CalendarEvent) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

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

  const updateEvent = api.calendar.updateEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();

      resetForm();
      setEditOpen(false);
      setSelectedEvent(null);
    },
  });

  const deleteEvent = api.calendar.deleteEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();

      resetForm();
      setEditOpen(false);
      setSelectedEvent(null);
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

  function openEditEvent(event: CalendarEvent) {
    setSelectedEvent(event);

    setSummary(event.summary);
    setDescription(event.description);
    setLocation(event.location);
    setStart(toDatetimeLocalFromIso(event.start));
    setEnd(toDatetimeLocalFromIso(event.end));
    setAttendees(extractAttendeeEmails(event.attendees).join(", "));

    setEditOpen(true);
  }

  const groupedEvents = groupEventsByDay(events.data ?? []);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">Calendar</h2>

            <p className="text-muted-foreground text-xs">
              {week.start.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              -{" "}
              {week.end.toLocaleDateString("en-US", {
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

        {(refreshEvents.data ?? refreshEvents.error) && (
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
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />

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

        <section className="bg-muted/20 min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {events.isLoading && <StatusLine>Loading events...</StatusLine>}

          {events.error && (
            <StatusLine tone="error">{events.error.message}</StatusLine>
          )}

          {events.data && (
            <>
              {events.data.length === 0 ? (
                <div className="bg-background rounded-lg border border-dashed py-14 text-center">
                  <p className="text-sm font-medium">No events this week</p>

                  <p className="text-muted-foreground mt-1 text-sm">
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

                        <p className="text-muted-foreground text-xs">
                          {group.events.length} event
                          {group.events.length === 1 ? "" : "s"}
                        </p>
                      </div>

                      <ul className="flex flex-col gap-2">
                        {group.events.map((event) => (
                          <EventRow
                            key={event.id}
                            event={event}
                            onEdit={() => openEditEvent(event)}
                            onEmailAttendees={() => onEmailAttendees(event)}
                          />
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

      {/* Create Event */}
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
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />

            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
                Start
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>

              <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
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
              <p className="text-destructive text-sm">
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

      {/* Edit Event */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Edit event</SheetTitle>
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
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />

            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
                Start
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>

              <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
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

            {(updateEvent.error ?? deleteEvent.error) && (
              <p className="text-destructive text-sm">
                {(updateEvent.error ?? deleteEvent.error)?.message}
              </p>
            )}
          </div>

          <SheetFooter className="border-t sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!selectedEvent) return;

                const confirmed = window.confirm(
                  "Delete this event? Attendees will be notified.",
                );

                if (!confirmed) return;

                deleteEvent.mutate({
                  id: selectedEvent.id,
                });
              }}
              disabled={deleteEvent.isPending || updateEvent.isPending}
            >
              {deleteEvent.isPending ? "Deleting" : "Delete event"}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={updateEvent.isPending || deleteEvent.isPending}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => {
                  if (!selectedEvent) return;

                  updateEvent.mutate({
                    id: selectedEvent.id,
                    ...eventInput,
                  });
                }}
                disabled={
                  updateEvent.isPending ||
                  deleteEvent.isPending ||
                  !selectedEvent ||
                  !summary ||
                  !start ||
                  !end
                }
              >
                {updateEvent.isPending ? "Saving" : "Save changes"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function EventRow({
  event,
  onEdit,
  onEmailAttendees,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onEmailAttendees: () => void;
}) {
  return (
    <li className="group bg-background hover:bg-card rounded-lg border p-4 transition-colors">
      <div className="flex gap-3">
        <div className="bg-primary/70 mt-1 h-10 w-1 shrink-0 rounded-full" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="hover:text-primary min-w-0 truncate text-left text-sm font-semibold"
            >
              {event.summary || "Untitled"}
            </button>

            {event.start && (
              <span className="text-muted-foreground text-xs font-medium">
                {formatEventWhen(event.start, event.end)}
              </span>
            )}
          </div>

          {event.location && (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </p>
          )}

          {event.description && (
            <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6 whitespace-pre-wrap">
              <LinkifiedText text={event.description} />
            </p>
          )}

          {event.attendees.length > 0 && (
            <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{formatAttendees(event.attendees)}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {event.attendees.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEmailAttendees}
              aria-label="Email attendees"
              title="Email attendees"
              className="opacity-70 transition-opacity group-hover:opacity-100"
            >
              <Mail className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Edit event"
            title="Edit event"
            className="opacity-70 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </Button>
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
