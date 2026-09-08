"use client";

import {
  CalendarDays,
  Clock3,
  Mail,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventTime } from "@/types/calendar";
import { Button } from "@/components/ui/button";

const HOUR_HEIGHT = 72;
const HOURS = Array.from({ length: 24 }, (_, index) => index);

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

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isToday(value: Date) {
  return isSameDay(value, new Date());
}

function eventDateTime(value: CalendarEventTime) {
  if (value.type === "allDay") {
    const [year, month, day] = value.date.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }

  return new Date(value.dateTime);
}

function eventEndDateTime(value: CalendarEventTime) {
  return eventDateTime(value);
}

function eventOccursOnDay(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  if (event.start.type === "allDay" || event.end.type === "allDay") {
    const start = eventDateTime(event.start);
    const end = eventEndDateTime(event.end);
    return start < dayEnd && end > dayStart;
  }

  const start = eventDateTime(event.start);
  const end = eventDateTime(event.end);
  return start < dayEnd && end > dayStart;
}

function eventStartsOnDay(event: CalendarEvent, day: Date) {
  return isSameDay(eventDateTime(event.start), day);
}

function eventTimeLabel(event: CalendarEvent) {
  if (event.start.type === "allDay") return "All day";

  const start = eventDateTime(event.start);
  const end = eventEndDateTime(event.end);
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function shortTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function dayLabel(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", options).format(value);
}

function eventColor(colorId?: string) {
  const colors: Record<string, string> = {
    "1": "#7986cb",
    "2": "#33b679",
    "3": "#8e24aa",
    "4": "#e67c73",
    "5": "#f6c344",
    "6": "#f4511e",
    "7": "#039be5",
    "8": "#616161",
    "9": "#3f51b5",
    "10": "#0b8043",
    "11": "#d50000",
  };
  return colors[colorId ?? ""] ?? "currentColor";
}

function eventDotClass(event: CalendarEvent) {
  return event.colorId ? "" : "bg-primary/70";
}

function EventButton({
  event,
  onOpen,
  compact = false,
  onMove,
}: {
  event: CalendarEvent;
  onOpen: (event: CalendarEvent) => void;
  compact?: boolean;
  onMove?: (event: CalendarEvent, target: Date) => void;
}) {
  return (
    <button
      type="button"
      draggable={Boolean(onMove && event.start.type === "timed")}
      onDragStart={(dragEvent) => {
        if (!onMove || event.start.type !== "timed") return;
        dragEvent.dataTransfer.effectAllowed = "move";
        dragEvent.dataTransfer.setData("text/calendar-event-id", event.id);

        // Preserve the exact point inside the event where the drag started.
        // This prevents the drop from being shifted by the event's height.
        const rect = dragEvent.currentTarget.getBoundingClientRect();
        const offsetY = dragEvent.clientY - rect.top;
        dragEvent.dataTransfer.setData(
          "text/calendar-event-offset-y",
          String(offsetY),
        );
      }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onOpen(event);
      }}
      className={cn(
        "group/event w-full min-w-0 rounded-md border border-border/60 bg-card/80 text-left transition-colors hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        compact ? "px-1.5 py-1" : "px-2.5 py-2",
      )}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <span
          className={cn(
            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
            eventDotClass(event),
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">
            {event.summary || "Untitled"}
          </span>
          {!compact && (
            <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
              {eventTimeLabel(event)}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

function AllDayStrip({
  events,
  onOpen,
}: {
  events: CalendarEvent[];
  onOpen: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) return null;

  return (
    <div className="mb-1 flex min-w-0 flex-col gap-1">
      {events.slice(0, 3).map((event) => (
        <EventButton key={event.id} event={event} onOpen={onOpen} compact />
      ))}
      {events.length > 3 && (
        <span className="text-muted-foreground px-1 text-[10px]">
          +{events.length - 3} more
        </span>
      )}
    </div>
  );
}

export function MonthView({
  anchorDate,
  events,
  onOpenEvent,
  onSelectDate,
}: {
  anchorDate: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onSelectDate: (date: Date) => void;
}) {
  const monthStart = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1,
  );
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index),
  );
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="text-muted-foreground px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide sm:px-2 sm:text-xs"
          >
            <span className="sm:hidden">{dayLabel(day, { weekday: "narrow" })}</span>
            <span className="hidden sm:inline">
              {dayLabel(day, { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-b-lg border-l border-b">
        {days.map((day) => {
          const dayEvents = events.filter((event) => eventOccursOnDay(event, day));
          const allDayEvents = dayEvents.filter(
            (event) => event.start.type === "allDay",
          );
          const timedEvents = dayEvents.filter(
            (event) => event.start.type !== "allDay",
          );
          const outsideMonth = day.getMonth() !== anchorDate.getMonth();

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-w-0 border-r border-t p-1.5 sm:min-h-28 sm:p-2",
                "min-h-20",
                outsideMonth && "bg-muted/20",
                isToday(day) && "bg-primary/5",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none sm:h-8 sm:w-8 sm:text-sm",
                  outsideMonth && "text-muted-foreground",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
                aria-label={`Open ${dayLabel(day, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`}
              >
                {day.getDate()}
              </button>

              <AllDayStrip events={allDayEvents} onOpen={onOpenEvent} />

              <div className="flex min-w-0 flex-col gap-1">
                {timedEvents.slice(0, 3).map((event) => (
                  <EventButton
                    key={event.id}
                    event={event}
                    onOpen={onOpenEvent}
                    compact
                  />
                ))}
                {timedEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onSelectDate(day)}
                    className="text-primary px-1 text-left text-[10px] font-medium hover:underline"
                  >
                    +{timedEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileDayView({
  day,
  events,
  onOpenEvent,
}: {
  day: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const dayEvents = events.filter((event) => eventOccursOnDay(event, day));
  const allDayEvents = dayEvents.filter((event) => event.start.type === "allDay");
  const timedEvents = dayEvents.filter((event) => event.start.type !== "allDay");

  return (
    <div className="space-y-3 md:hidden">
      <div className="bg-card rounded-lg border p-3">
        <p className="font-heading text-sm font-semibold">
          {dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
        </p>
      </div>

      {allDayEvents.length > 0 && (
        <div className="bg-card rounded-lg border p-3">
          <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
            All day
          </p>
          <div className="space-y-1">
            {allDayEvents.map((event) => (
              <EventButton key={event.id} event={event} onOpen={onOpenEvent} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-card overflow-hidden rounded-lg border">
        {timedEvents.length === 0 ? (
          <EmptyDay />
        ) : (
          timedEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event)}
              className="flex min-h-16 w-full items-center gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-muted-foreground w-20 shrink-0 text-right text-xs">
                {eventTimeLabel(event)}
              </span>
              <span className="bg-primary h-8 w-1 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {event.summary || "Untitled"}
                </span>
                {event.location && (
                  <span className="text-muted-foreground mt-1 flex items-center gap-1 truncate text-xs">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {event.location}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  events,
  onOpenEvent,
  onSelectTime,
  onMoveEvent,
}: {
  days: Date[];
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onSelectTime?: (date: Date) => void;
  onMoveEvent?: (event: CalendarEvent, target: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setCurrentTime(new Date().getHours() * 60 + new Date().getMinutes());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hasToday = days.some(isToday);
    const now = new Date();
    const initialHour = hasToday ? Math.max(0, now.getHours() - 1) : 8;
    const initialMinute = hasToday ? now.getMinutes() : 0;
    const targetScrollTop = (initialHour * 60 + initialMinute) / 60 * HOUR_HEIGHT;

    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = Math.max(0, targetScrollTop);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [days[0]?.getTime(), days.length]);

  return (
    <div className="hidden min-w-0 md:block">
      <div
        ref={scrollRef}
        className="bg-card max-h-[min(65vh,640px)] overflow-y-auto overscroll-contain rounded-lg border"
      >
        <div
          className="sticky top-0 z-20 grid bg-card"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="border-b" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-b border-l px-2 py-2 text-center",
                isToday(day) && "bg-primary/5",
              )}
            >
              <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                {dayLabel(day, { weekday: "short" })}
              </p>
              <p
                className={cn(
                  "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </p>
              <div className="mt-1 text-left">
                <AllDayStrip
                  events={events.filter(
                    (event) =>
                      event.start.type === "allDay" && eventOccursOnDay(event, day),
                  )}
                  onOpen={onOpenEvent}
                />
              </div>
            </div>
          ))}
        </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-muted-foreground flex h-[72px] items-start justify-end border-t px-2 pt-1 text-[10px]"
              >
                {hour === 0 ? "" : shortTimeLabel(new Date(2000, 0, 1, hour))}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = events.filter(
              (event) =>
                event.start.type !== "allDay" && eventOccursOnDay(event, day),
            );
            const allDayEvents = events.filter(
              (event) => event.start.type === "allDay" && eventOccursOnDay(event, day),
            );

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-l",
                  isToday(day) && "bg-primary/[0.025]",
                )}
                onDragOver={(dragEvent) => {
                  if (!onMoveEvent) return;
                  dragEvent.preventDefault();
                  dragEvent.dataTransfer.dropEffect = "move";
                }}
                onDrop={(dropEvent) => {
                  if (!onMoveEvent) return;
                  dropEvent.preventDefault();
                  const eventId = dropEvent.dataTransfer.getData("text/calendar-event-id");
                  const draggedEvent = events.find((event) => event.id === eventId);
                  if (draggedEvent?.start.type !== "timed") return;

                  const rect = dropEvent.currentTarget.querySelector<HTMLElement>(
                    "[data-calendar-time-grid]",
                  );
                  if (!rect) return;

                  const offsetY = Number(
                    dropEvent.dataTransfer.getData(
                      "text/calendar-event-offset-y",
                    ) || "0",
                  );

                  // Account for the scroll position and the point where the
                  // pointer grabbed the event so the event lands under the
                  // same cursor position instead of being shifted by 30 min.
                  const localY =
                  dropEvent.clientY -
                  rect.getBoundingClientRect().top +
                  (scrollRef.current?.scrollTop ?? 0) -
                  offsetY;

                  const minutes = Math.max(
                    0,
                    Math.min(
                      1439,
                      Math.round(
                        ((localY / rect.getBoundingClientRect().height) * 1440) /
                          30,
                      ) * 30,
                    ),
                  );
                  const target = new Date(day);
                  target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
                  onMoveEvent(draggedEvent, target);
                }}
              >
                <div className="border-b px-1 py-1 md:hidden">
                  <AllDayStrip events={allDayEvents} onOpen={onOpenEvent} />
                </div>
                <div data-calendar-time-grid className="relative h-[1728px]">
                  {onSelectTime && (
                    <button
                      type="button"
                      aria-label={`Create event on ${dayLabel(day, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}`}
                      className="absolute inset-0 z-0 w-full cursor-pointer focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const minutesFromMidnight = Math.max(
                          0,
                          Math.min(
                            1439,
                            Math.round(
                              (((event.clientY - rect.top) / rect.height) * 1440) / 30,
                            ) * 30,
                          ),
                        );
                        const selected = new Date(day);
                        selected.setHours(
                          Math.floor(minutesFromMidnight / 60),
                          minutesFromMidnight % 60,
                          0,
                          0,
                        );
                        onSelectTime(selected);
                      }}
                    />
                  )}

                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="pointer-events-none absolute inset-x-0 border-t"
                      style={{ top: hour * HOUR_HEIGHT }}
                    />
                  ))}

                  {isToday(day) && currentTime !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary"
                      style={{ top: (currentTime / 60) * HOUR_HEIGHT }}
                      aria-hidden="true"
                    >
                      <span className="absolute -left-1 -top-1.5 h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}

                  {dayEvents.map((event) => {
                    const start = eventDateTime(event.start);
                    const end = eventEndDateTime(event.end);
                    const dayStart = startOfDay(day);
                    const dayEnd = addDays(dayStart, 1);
                    const visibleStart = start < dayStart ? dayStart : start;
                    const visibleEnd = end > dayEnd ? dayEnd : end;
                    const startMinutes =
                      visibleStart.getHours() * 60 + visibleStart.getMinutes();
                    const endMinutes = Math.max(
                      startMinutes + 30,
                      visibleEnd.getHours() * 60 + visibleEnd.getMinutes(),
                    );
                    const top = (startMinutes / 60) * HOUR_HEIGHT;
                    const height = Math.max(
                      42,
                      ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
                    );

                    return (
                      <div
                        key={event.id}
                        className="absolute inset-x-1"
                        style={{ top, height }}
                      >
                        <EventButton event={event} onOpen={onOpenEvent} onMove={onMoveEvent} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
  );
}

export function WeekView({
  anchorDate,
  events,
  onOpenEvent,
  onSelectTime,
  onMoveEvent,
}: {
  anchorDate: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onSelectTime?: (date: Date) => void;
  onMoveEvent?: (event: CalendarEvent, target: Date) => void;
}) {
  const weekStart = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const mobileDay = isSameDay(anchorDate, weekStart)
    ? weekStart
    : startOfDay(anchorDate);

  return (
    <>
      <TimeGrid
        days={days}
        events={events}
        onOpenEvent={onOpenEvent}
        onSelectTime={onSelectTime}
        onMoveEvent={onMoveEvent}
      />
      <MobileDayView day={mobileDay} events={events} onOpenEvent={onOpenEvent} />
    </>
  );
}

export function DayView({
  anchorDate,
  events,
  onOpenEvent,
  onSelectTime,
  onMoveEvent,
}: {
  anchorDate: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onSelectTime?: (date: Date) => void;
  onMoveEvent?: (event: CalendarEvent, target: Date) => void;
}) {
  return (
    <>
      <TimeGrid
        days={[startOfDay(anchorDate)]}
        events={events}
        onOpenEvent={onOpenEvent}
        onSelectTime={onSelectTime}
        onMoveEvent={onMoveEvent}
      />
      <MobileDayView
        day={startOfDay(anchorDate)}
        events={events}
        onOpenEvent={onOpenEvent}
      />
    </>
  );
}

function EmptyDay() {
  return (
    <div className="text-muted-foreground flex min-h-28 flex-col items-center justify-center gap-2 px-4 text-center">
      <Clock3 className="h-4 w-4" />
      <p className="text-sm">No timed events</p>
    </div>
  );
}

function AgendaEventCard({
  event,
  onOpenEvent,
  onEmailAttendees,
}: {
  event: CalendarEvent;
  onOpenEvent: (event: CalendarEvent) => void;
  onEmailAttendees: (event: CalendarEvent) => void;
}) {
  return (
    <div className="group flex min-w-0 w-full items-start gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-muted/50 sm:px-4">
      <span className="bg-primary mt-1 h-9 w-1 shrink-0 rounded-full" />
      <button
        type="button"
        onClick={() => onOpenEvent(event)}
        className="min-w-0 flex-1 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <span className="truncate text-sm font-semibold">
            {event.summary || "Untitled"}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {eventTimeLabel(event)}
          </span>
        </span>
        {(event.location || event.attendees.length > 0) && (
          <span className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {event.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
            {event.attendees.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.attendees.length} attendee
                {event.attendees.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1 self-start">
        {event.attendees.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEmailAttendees(event)}
            aria-label="Email attendees"
            title="Email attendees"
            className="h-10 w-10 sm:h-8 sm:w-8"
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenEvent(event)}
          aria-label="Edit event"
          title="Edit event"
          className="h-10 w-10 sm:h-8 sm:w-8"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AgendaView({
  startDate,
  events,
  onOpenEvent,
  onEmailAttendees,
}: {
  startDate: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onEmailAttendees: (event: CalendarEvent) => void;
}) {
  const days = Array.from({ length: 14 }, (_, index) => addDays(startDate, index));

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayEvents = events.filter((event) => eventOccursOnDay(event, day));
        if (dayEvents.length === 0) return null;

        return (
          <section key={day.toISOString()} className="bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-3 py-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-sm font-semibold">
                    {dayLabel(day, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                  </p>
                </div>
                {isToday(day) && (
                  <span className="text-primary text-[10px] font-semibold uppercase tracking-wide">
                    Today
                  </span>
                )}
              </div>
            </div>
            <div>
              {dayEvents.map((event) => (
                <AgendaEventCard
                  key={event.id}
                  event={event}
                  onOpenEvent={onOpenEvent}
                  onEmailAttendees={onEmailAttendees}
                />
              ))}
            </div>
          </section>
        );
      })}

      {events.length === 0 && (
        <div className="bg-card text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center">
          <CalendarDays className="h-5 w-5" />
          <p className="text-sm">No events in this range</p>
        </div>
      )}
    </div>
  );
}

export function CalendarViewLoading() {
  return (
    <div className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
      Loading calendar…
    </div>
  );
}

export function CalendarViewError({ children }: { children: ReactNode }) {
  return (
    <div className="text-destructive flex min-h-32 items-center justify-center px-4 text-center text-sm">
      {children}
    </div>
  );
}

export function CalendarViewEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center">
      <p className="text-sm font-medium">No events in this range</p>
      <p className="text-muted-foreground max-w-sm text-xs">
        Your calendar is clear here. Create an event to start filling this view.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onCreate}>
        Create event
      </Button>
    </div>
  );
}
