"use client";

import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Mail,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent as NormalizedCalendarEvent, CalendarView } from "@/types/calendar";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AgendaView,
  CalendarViewEmpty,
  CalendarViewError,
  CalendarViewLoading,
  DayView,
  MonthView,
  WeekView,
} from "@/app/_components/calendar-views";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultEventRange() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    start: toDatetimeLocalValue(start),
    end: toDatetimeLocalValue(end),
  };
}

function toDatetimeLocalFromIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return toDatetimeLocalValue(date);
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(value: Date) {
  const result = startOfDay(value);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + mondayOffset);
  return result;
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  return result;
}

function getCalendarTimeZone() {
  return Intl.DateTimeFormat("en-US").resolvedOptions().timeZone || "UTC";
}

function getMonthGridRange(anchorDate: Date) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  return { start: gridStart, end: addDays(gridStart, 42) };
}

function getViewRange(view: CalendarView, anchorDate: Date) {
  if (view === "month") return getMonthGridRange(anchorDate);

  if (view === "day") {
    const start = startOfDay(anchorDate);
    return { start, end: addDays(start, 1) };
  }

  const start = startOfWeek(anchorDate);
  return {
    start,
    end: addDays(start, view === "agenda" ? 14 : 7),
  };
}

function formatViewLabel(view: CalendarView, anchorDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  if (view === "month") return formatter.format(anchorDate);

  if (view === "day") {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(anchorDate);
  }

  const range = getViewRange(view, anchorDate);
  const end = new Date(range.end);
  end.setDate(end.getDate() - 1);
  const startPart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(range.start);
  const endPart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(end);

  return `${startPart} – ${endPart}`;
}

function navigateAnchor(view: CalendarView, anchorDate: Date, direction: number) {
  if (view === "month") return addMonths(anchorDate, direction);
  return addDays(anchorDate, view === "agenda" ? direction * 7 : direction * (view === "week" ? 7 : 1));
}

function normalizedToLegacyEvent(event: NormalizedCalendarEvent): CalendarEvent {
  const start =
    event.start.type === "timed"
      ? event.start.dateTime
      : `${event.start.date}T00:00:00.000Z`;
  const end =
    event.end.type === "timed"
      ? event.end.dateTime
      : `${event.end.date}T00:00:00.000Z`;

  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    status: event.status,
    start,
    end,
    attendees: event.attendees
      .map((attendee) => {
        if (attendee.email && attendee.displayName) {
          return `${attendee.displayName} <${attendee.email}>`;
        }
        return attendee.email ?? attendee.displayName ?? "";
      })
      .filter(Boolean),
    htmlLink: event.htmlLink,
  };
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
  focusCreateSignal,
  todaySignal,
  onEmailAttendees,
}: {
  focusCreateSignal: number;
  todaySignal: number;
  onEmailAttendees: (event: CalendarEvent) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeView, setActiveView] = useState<CalendarView>("agenda");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const timeZone = getCalendarTimeZone();
  const range = useMemo(
    () => getViewRange(activeView, anchorDate),
    [activeView, anchorDate],
  );

  const [defaultRange] = useState(getDefaultEventRange);

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);
  const [attendees, setAttendees] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (focusCreateSignal > 0) setCreateOpen(true);
  }, [focusCreateSignal]);

  useEffect(() => {
    if (todaySignal > 0) {
      const today = new Date();
      setAnchorDate(today);
    }
  }, [todaySignal]);

  const utils = api.useUtils();
  const events = api.calendar.getEvents.useQuery({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    timeZone,
    query: activeSearch || undefined,
  });

  const refreshEvents = api.calendar.refreshEventsRange.useMutation({
    onSuccess: async () => {
      await utils.calendar.getEvents.invalidate();
      await utils.calendar.searchEvents.invalidate();
    },
  });

  const autoRefreshedRange = useRef<string | null>(null);
  const rangeKey = `${range.start.toISOString()}|${range.end.toISOString()}`;

  useEffect(() => {
    if (
      events.isLoading ||
      events.isFetching ||
      events.error ||
      refreshEvents.isPending ||
      autoRefreshedRange.current === rangeKey
    ) {
      return;
    }

    autoRefreshedRange.current = rangeKey;
    refreshEvents.mutate({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      timeZone,
    });
  }, [
    events.isLoading,
    events.isFetching,
    events.error,
    refreshEvents.isPending,
    refreshEvents.mutate,
    rangeKey,
    range.start,
    range.end,
    timeZone,
  ]);

  const createDraft = api.calendar.createDraft.useMutation({
    onSuccess: async () => {
      await utils.calendar.getEvents.invalidate();
      await utils.calendar.searchEvents.invalidate();
      resetForm();
      setCreateOpen(false);
    },
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: async () => {
      await utils.calendar.getEvents.invalidate();
      await utils.calendar.searchEvents.invalidate();
      resetForm();
      setCreateOpen(false);
    },
  });

  const updateEvent = api.calendar.updateEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.getEvents.invalidate();
      await utils.calendar.searchEvents.invalidate();
      resetForm();
      setEditOpen(false);
      setSelectedEvent(null);
    },
  });

  const moveEvent = api.calendar.updateEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.getEvents.invalidate();
      await utils.calendar.searchEvents.invalidate();
    },
    onError: (error) => {
      window.alert(`Could not move event: ${error.message}`);
    },
  });

  const deleteEvent = api.calendar.deleteEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.getEvents.invalidate();
      await utils.calendar.searchEvents.invalidate();
      resetForm();
      setEditOpen(false);
      setSelectedEvent(null);
    },
  });

  function resetForm() {
    const nextRange = getDefaultEventRange();
    setSummary("");
    setDescription("");
    setLocation("");
    setStart(nextRange.start);
    setEnd(nextRange.end);
    setAttendees("");
    setFormError(null);
  }

  function parseAttendees() {
    return attendees
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function toIso(datetimeLocal: string) {
    const date = new Date(datetimeLocal);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function handleMoveEvent(event: NormalizedCalendarEvent, target: Date) {
    if (event.start.type !== "timed" || event.end.type !== "timed") return;

    const originalStart = new Date(event.start.dateTime);
    const originalEnd = new Date(event.end.dateTime);
    const duration = Math.max(30 * 60_000, originalEnd.getTime() - originalStart.getTime());
    const nextStart = new Date(target);
    const nextEnd = new Date(nextStart.getTime() + duration);

    moveEvent.mutate({
      id: event.id,
      summary: event.summary || "Untitled",
      description: event.description || undefined,
      location: event.location || undefined,
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
      attendees: event.attendees
        .map((attendee) => attendee.email)
        .filter((email): email is string => Boolean(email)),
    });
  }

  function handleSelectTime(date: Date) {
    const nextStart = new Date(date);
    const nextEnd = new Date(nextStart);
    nextEnd.setHours(nextEnd.getHours() + 1);

    setStart(toDatetimeLocalValue(nextStart));
    setEnd(toDatetimeLocalValue(nextEnd));
    setCreateOpen(true);
  }

  const eventInput = {
    summary: summary.trim(),
    description: description.trim() || undefined,
    location: location.trim() || undefined,
    start: toIso(start),
    end: toIso(end),
    attendees: parseAttendees(),
  };

  function validateCreateForm(requireAttendees: boolean) {
    if (!summary.trim()) return "Add an event title to continue.";
    if (!start || !end) return "Choose a start and end date/time.";

    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return "Enter valid start and end date/times.";
    }
    if (endTime <= startTime) {
      return "The end time must be later than the start time.";
    }

    const emailAddresses = parseAttendees();
    const invalidAddress = emailAddresses.find(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    );
    if (invalidAddress) return `Check this email address: ${invalidAddress}`;
    if (requireAttendees && emailAddresses.length === 0) {
      return "Add at least one guest to send an invitation.";
    }

    return null;
  }

  function submitCreateForm(mode: "draft" | "invite") {
    const error = validateCreateForm(mode === "invite");
    setFormError(error);
    if (error) return;

    if (mode === "draft") createDraft.mutate(eventInput);
    else sendInvite.mutate(eventInput);
  }

  function openEditEvent(event: NormalizedCalendarEvent) {
    if (event.start.type === "allDay" || event.end.type === "allDay") return;

    const legacyEvent = normalizedToLegacyEvent(event);
    setSelectedEvent(legacyEvent);
    setSummary(event.summary);
    setDescription(event.description);
    setLocation(event.location);
    setStart(toDatetimeLocalFromIso(event.start.dateTime));
    setEnd(toDatetimeLocalFromIso(event.end.dateTime));
    setAttendees(extractAttendeeEmails(legacyEvent.attendees).join(", "));
    setEditOpen(true);
  }

  function handleOpenEvent(event: NormalizedCalendarEvent) {
    if (event.start.type === "allDay") return;
    openEditEvent(event);
  }

  function handleSelectDate(date: Date) {
    setAnchorDate(date);
    if (activeView === "month") {
      setActiveView("day");
    }
  }

  function handleToday() {
    const today = new Date();
    setAnchorDate(today);
  }

  const viewButtons: Array<{ id: CalendarView; label: string; icon: typeof List }> = [
    { id: "agenda", label: "Agenda", icon: List },
    { id: "month", label: "Month", icon: Grid2X2 },
    { id: "week", label: "Week", icon: CalendarDays },
    { id: "day", label: "Day", icon: CalendarDays },
  ];

  const eventsData = events.data ?? [];
  const showEmpty = !events.isLoading && !events.error && events.data?.length === 0;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b px-3 py-3 sm:px-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h2 className="font-heading truncate text-base font-semibold">
                      Calendar
                    </h2>
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      Google Calendar
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatViewLabel(activeView, anchorDate)}
                  </p>
                </div>
              </div>

              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="h-10 text-xs sm:h-8"
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAnchorDate((value) => navigateAnchor(activeView, value, -1))}
                    aria-label={`Previous ${activeView}`}
                    title={`Previous ${activeView}`}
                    className="h-10 w-10 sm:h-8 sm:w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAnchorDate((value) => navigateAnchor(activeView, value, 1))}
                    aria-label={`Next ${activeView}`}
                    title={`Next ${activeView}`}
                    className="h-10 w-10 sm:h-8 sm:w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="h-10 text-xs sm:h-8"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>Create</span>
                </Button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-muted-foreground mr-1 shrink-0 text-[11px] font-medium uppercase tracking-wide">
                  View
                </span>
                {viewButtons.map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    type="button"
                    variant={activeView === id ? "secondary" : "ghost"}
                    size="sm"
                    aria-current={activeView === id ? "page" : undefined}
                    onClick={() => setActiveView(id)}
                    className="h-9 shrink-0 gap-1.5 text-xs sm:h-7"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                ))}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
                <span className="text-muted-foreground hidden text-xs md:inline">
                  {eventsData.length} event{eventsData.length === 1 ? "" : "s"} in view
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    refreshEvents.mutate({
                      start: range.start.toISOString(),
                      end: range.end.toISOString(),
                      timeZone,
                    })
                  }
                  disabled={refreshEvents.isPending}
                  className="h-9 text-xs sm:h-7"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      refreshEvents.isPending && "animate-spin",
                    )}
                  />
                  <span>{refreshEvents.isPending ? "Refreshing" : "Refresh"}</span>
                </Button>
              </div>
            </div>
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

        <div className="shrink-0 border-b px-3 py-3 sm:px-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setActiveSearch(search.trim());
            }}
            className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events"
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline" className="h-10 sm:h-8">
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
                className="h-10 w-full sm:h-8 sm:w-auto"
              >
                Clear
              </Button>
            )}
          </form>
        </div>

        <section className="bg-muted/20 min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          <div className="mx-auto max-w-6xl">
            {events.isLoading && <CalendarViewLoading />}
            {events.error && <CalendarViewError>{events.error.message}</CalendarViewError>}

            {!events.isLoading && !events.error && (
              <>
                {activeView === "month" && (
                  <MonthView
                    anchorDate={anchorDate}
                    events={eventsData}
                    onOpenEvent={handleOpenEvent}
                    onSelectDate={handleSelectDate}
                  />
                )}
                {activeView === "week" && (
                  <WeekView
                    anchorDate={anchorDate}
                    events={eventsData}
                    onOpenEvent={handleOpenEvent}
                    onSelectTime={handleSelectTime}
                    onMoveEvent={handleMoveEvent}
                  />
                )}
                {activeView === "day" && (
                  <DayView
                    anchorDate={anchorDate}
                    events={eventsData}
                    onOpenEvent={handleOpenEvent}
                    onSelectTime={handleSelectTime}
                    onMoveEvent={handleMoveEvent}
                  />
                )}
                {activeView === "agenda" && (
                  showEmpty ? (
                    <CalendarViewEmpty onCreate={() => setCreateOpen(true)} />
                  ) : (
                    <AgendaView
                      startDate={range.start}
                      events={eventsData}
                      onOpenEvent={handleOpenEvent}
                      onEmailAttendees={(event) =>
                        onEmailAttendees(normalizedToLegacyEvent(event))
                      }
                    />
                  )
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <SheetContent
          side="right"
          className="inset-y-3 right-3 h-[calc(100dvh-1.5rem)] w-[min(44rem,calc(100vw-1.5rem))] max-w-none gap-0 overflow-hidden rounded-2xl border border-border/80 bg-card p-0 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.65)] sm:max-w-none"
        >
          <SheetHeader className="shrink-0 border-b border-border/80 bg-card px-5 py-4 pr-14 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-highlight">
                <CalendarPlus className="size-5" />
              </span>
              <div className="min-w-0 text-left">
                <SheetTitle className="text-base font-semibold">Create event</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add the details and invite people to your event.
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-background/35 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
            <section className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
              <div>
                <p className="text-sm font-semibold">Event details</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Give your event a name and a little context.
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Event title</span>
                <Input
                  type="text"
                  value={summary}
                  onChange={(event) => {
                    setSummary(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="e.g. Project planning meeting"
                  autoFocus
                  className="h-11 rounded-lg bg-background"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add an agenda, notes or useful context..."
                  rows={4}
                  className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-3"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Location or meeting link</span>
                <div className="relative">
                  <MapPin className="absolute top-3 left-3 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Add a room, address or meeting link"
                    className="h-11 bg-background pl-9"
                  />
                </div>
              </label>
            </section>

            <section className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-highlight">
                  <Clock3 className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Date and time</p>
                  <p className="text-xs text-muted-foreground">Choose when the event starts and ends.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  Start
                  <Input
                    type="datetime-local"
                    className="h-11 min-w-0 bg-background"
                    value={start}
                    onChange={(event) => {
                      setStart(event.target.value);
                      setFormError(null);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  End
                  <Input
                    type="datetime-local"
                    className="h-11 min-w-0 bg-background"
                    value={end}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      setFormError(null);
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-highlight">
                  <Users className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Guests</p>
                  <p className="text-xs text-muted-foreground">Invite people using their email addresses.</p>
                </div>
              </div>
              <Input
                type="text"
                value={attendees}
                onChange={(event) => {
                  setAttendees(event.target.value);
                  setFormError(null);
                }}
                placeholder="name@example.com, colleague@example.com"
                className="h-11 bg-background"
              />
              <p className="text-[11px] text-muted-foreground">Separate multiple guests with commas.</p>
            </section>

            {(formError || createDraft.error || sendInvite.error) && (
              <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError ?? createDraft.error?.message ?? sendInvite.error?.message}
              </p>
            )}
          </div>

          <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-between gap-2 border-t border-border/80 bg-card px-4 py-3 sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => submitCreateForm("draft")}
              disabled={createDraft.isPending || sendInvite.isPending}
              className="h-10 px-4"
            >
              {createDraft.isPending ? "Saving..." : "Save draft"}
            </Button>
            <Button
              type="button"
              onClick={() => submitCreateForm("invite")}
              disabled={createDraft.isPending || sendInvite.isPending}
              className="h-10 gap-2 bg-highlight px-5 text-white hover:bg-highlight/90"
            >
              <CalendarPlus className="size-4" />
              {sendInvite.isPending ? "Sending..." : "Send invite"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Edit event</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
            <Input
              type="text"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Title"
              autoFocus
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              rows={4}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
            <Input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
                Start
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
                End
                <Input
                  type="datetime-local"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>
            <Input
              type="text"
              value={attendees}
              onChange={(event) => setAttendees(event.target.value)}
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
                deleteEvent.mutate({ id: selectedEvent.id });
              }}
              disabled={deleteEvent.isPending || updateEvent.isPending}
            >
              {deleteEvent.isPending ? "Deleting" : "Delete event"}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {selectedEvent?.attendees.length ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!selectedEvent) return;
                    onEmailAttendees(selectedEvent);
                    setEditOpen(false);
                    setSelectedEvent(null);
                  }}
                  disabled={updateEvent.isPending || deleteEvent.isPending}
                >
                  <Mail className="h-4 w-4" />
                  Email attendees
                </Button>
              ) : null}
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
                  updateEvent.mutate({ id: selectedEvent.id, ...eventInput });
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

