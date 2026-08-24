"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Loader2Icon,
  MapPinIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  StickyNoteIcon,
  UserRoundPlusIcon,
  XIcon,
} from "lucide-react";

import { formatAttendees, formatEventWhen, LinkifiedText } from "@/lib/display";
import { formatWeekLabel, getWeekBounds } from "@/lib/week";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CalendarPanel() {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const weekLabel = formatWeekLabel(week.start, week.end);

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
    },
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
      resetForm();
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

  return (
    <div className="grid min-h-[calc(100svh-6rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="border-border bg-card text-card-foreground flex min-h-0 flex-col rounded-xl border">
        <div className="border-border border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Google Calendar
              </p>
              <h3 className="font-heading text-lg font-semibold">
                {weekLabel}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Previous week"
              >
                <ChevronLeftIcon />
              </Button>
              {weekOffset !== 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(0)}
                >
                  This week
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Next week"
              >
                <ChevronRightIcon />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  refreshEvents.mutate({
                    weekStart: week.start.toISOString(),
                    weekEnd: week.end.toISOString(),
                  })
                }
                disabled={refreshEvents.isPending}
              >
                <RefreshCwIcon
                  className={cn(refreshEvents.isPending && "animate-spin")}
                />
                Sync
              </Button>
            </div>
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setActiveSearch(search);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                className="pl-8"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
              />
            </div>
            <Button type="submit" size="icon" aria-label="Search events">
              <SearchIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setActiveSearch("");
              }}
            >
              <XIcon />
            </Button>
          </form>

          {refreshEvents.data && (
            <p className="text-muted-foreground mt-3 text-xs">
              {refreshEvents.data.synced} events synced from Google Calendar.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {events.isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Loading events
            </div>
          )}

          {(events.error ?? refreshEvents.error) && (
            <p className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-lg border px-3 py-2 text-sm">
              {(events.error ?? refreshEvents.error)?.message}
            </p>
          )}

          {events.data && (
            <div className="space-y-3">
              {events.data.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                  No events in this view. Sync Calendar or create an invite.
                </div>
              ) : (
                events.data.map((event) => (
                  <article
                    key={event.id}
                    className="border-border bg-background/40 rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {event.htmlLink ? (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-heading text-base font-semibold underline-offset-4 hover:underline"
                          >
                            {event.summary || "Untitled"}
                          </a>
                        ) : (
                          <h4 className="font-heading text-base font-semibold">
                            {event.summary || "Untitled"}
                          </h4>
                        )}
                        {event.start && (
                          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                            <ClockIcon className="size-4" />
                            {formatEventWhen(event.start, event.end)}
                          </p>
                        )}
                      </div>
                      <div className="border-border bg-muted/40 text-muted-foreground rounded-md border px-2 py-1 text-xs">
                        Event
                      </div>
                    </div>

                    {event.location && (
                      <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
                        <MapPinIcon className="size-4" />
                        {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-card-foreground [&_a]:text-primary mt-3 text-sm leading-6 [&_a]:underline [&_a]:underline-offset-4">
                        <LinkifiedText text={event.description} />
                      </p>
                    )}
                    {event.attendees.length > 0 && (
                      <p className="text-muted-foreground mt-3 flex items-start gap-2 text-sm">
                        <UserRoundPlusIcon className="mt-0.5 size-4 shrink-0" />
                        <span>{formatAttendees(event.attendees)}</span>
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <CalendarPlusIcon className="size-4" />
            </div>
            <div>
              <CardTitle>Create event</CardTitle>
              <CardDescription>Save a draft or send an invite.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="calendar-title">Title</FieldLabel>
                <Input
                  id="calendar-title"
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Design review"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="calendar-description">
                  Description
                </FieldLabel>
                <textarea
                  id="calendar-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Agenda, links, or notes"
                  className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-28 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="calendar-location">Location</FieldLabel>
                <Input
                  id="calendar-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Google Meet or office"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="calendar-start">Start</FieldLabel>
                  <Input
                    id="calendar-start"
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="calendar-end">End</FieldLabel>
                  <Input
                    id="calendar-end"
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="calendar-attendees">Attendees</FieldLabel>
                <Input
                  id="calendar-attendees"
                  type="text"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="alex@example.com, taylor@example.com"
                />
              </Field>

              {(createDraft.error ?? sendInvite.error) && (
                <Field>
                  <FieldError>
                    {(createDraft.error ?? sendInvite.error)?.message}
                  </FieldError>
                </Field>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => createDraft.mutate(eventInput)}
                  disabled={createDraft.isPending || !summary || !start || !end}
                >
                  {createDraft.isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <StickyNoteIcon />
                  )}
                  Save draft
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
                  {sendInvite.isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <SendIcon />
                  )}
                  Send invite
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
