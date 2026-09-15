"use client";

import {
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  Video,
} from "lucide-react";
import type { CalendarEventItem } from "@/lib/agent-types";
import { Button } from "@/components/ui/button";

function formatCalendarTime(startStr: string, endStr?: string): {
  date: string;
  time: string;
  duration?: string;
} {
  try {
    const startDate = new Date(startStr);
    if (Number.isNaN(startDate.getTime())) {
      return { date: startStr, time: "" };
    }

    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(startDate);

    const startTimeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startDate);

    let timeStr = startTimeFormatted;
    let durationStr: string | undefined;

    if (endStr) {
      const endDate = new Date(endStr);
      if (!Number.isNaN(endDate.getTime())) {
        const endTimeFormatted = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(endDate);
        timeStr = `${startTimeFormatted} – ${endTimeFormatted}`;

        const diffMinutes = Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60),
        );
        if (diffMinutes > 0) {
          durationStr =
            diffMinutes >= 60
              ? `${Math.floor(diffMinutes / 60)}h${diffMinutes % 60 ? ` ${diffMinutes % 60}m` : ""}`
              : `${diffMinutes}m`;
        }
      }
    }

    return {
      date: dateFormatted,
      time: timeStr,
      duration: durationStr,
    };
  } catch {
    return { date: startStr, time: "" };
  }
}

export function AgentCalendarCard({
  event,
  index,
}: {
  event: CalendarEventItem;
  index: number;
}) {
  const { date, time, duration } = formatCalendarTime(event.start, event.end);

  const isMeetLocation =
    event.location?.startsWith("http") === true ||
    event.location?.includes("meet.google.com") === true;
  const hasMeetLink = Boolean(event.meetLink ?? isMeetLocation);

  const meetUrl =
    event.meetLink ??
    (hasMeetLink && event.location?.startsWith("http")
      ? event.location
      : undefined);

  return (
    <article
      className="group relative rounded-xl border border-border/80 bg-muted/15 p-3.5 sm:p-4 transition-all duration-150 hover:border-border hover:bg-muted/30 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/15 dark:hover:bg-zinc-900/80 shadow-xs"
      tabIndex={0}
      role="region"
      aria-label={`Calendar event: ${event.summary}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left column: Number box + Calendar Icon + Event Info */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Result Number Box */}
          <div
            className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-xs font-semibold text-muted-foreground select-none"
            aria-hidden="true"
          >
            {index + 1}
          </div>

          {/* Calendar Icon Box */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-xs">
            <Calendar className="size-4" />
          </div>

          {/* Event Content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Title */}
            <h4 className="font-semibold text-foreground text-sm leading-snug">
              {event.summary ?? "Untitled Event"}
            </h4>

            {/* Time & Duration row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="size-3.5 text-primary" />
                {time || date}
              </span>
              {duration && (
                <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">
                  {duration}
                </span>
              )}
            </div>

            {/* Location or Meet Link */}
            {event.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                {hasMeetLink ? (
                  <Video className="size-3.5 text-blue-500 shrink-0" />
                ) : (
                  <MapPin className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5 shrink-0" />
                <span className="truncate">
                  {event.attendees
                    .map((a) => a.displayName ?? a.email)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Date + Action */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 shrink-0 border-t border-border/40 sm:border-0">
          {date && (
            <div className="text-left sm:text-right text-xs font-medium text-muted-foreground">
              {date}
            </div>
          )}

          {meetUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(meetUrl, "_blank", "noopener,noreferrer")}
              className="h-8 gap-1.5 px-3 rounded-lg text-xs font-medium border-border/80 bg-background/80 hover:bg-accent transition-colors"
            >
              <Video className="size-3.5 text-blue-500" />
              <span>Join Meet</span>
              <ExternalLink className="size-3 opacity-60" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
