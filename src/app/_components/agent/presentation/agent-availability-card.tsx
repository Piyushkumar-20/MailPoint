"use client";

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  PlusCircle,
} from "lucide-react";
import type { AvailabilityData } from "@/lib/agent-types";

function formatDateTimeWindow(startStr?: string, endStr?: string): string {
  if (!startStr) return "";
  try {
    const startDate = new Date(startStr);
    if (Number.isNaN(startDate.getTime())) return startStr;

    const dateStr = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(startDate);

    const startTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startDate);

    if (endStr) {
      const endDate = new Date(endStr);
      if (!Number.isNaN(endDate.getTime())) {
        const endTime = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(endDate);
        return `${dateStr} · ${startTime} – ${endTime}`;
      }
    }
    return `${dateStr} · ${startTime}`;
  } catch {
    return startStr;
  }
}

export function AgentAvailabilityCard({
  availability,
  onScheduleSlot,
}: {
  availability: AvailabilityData;
  onScheduleSlot?: (slot: { start: string; end: string }) => void;
}) {
  const isAvailable = availability.isAvailable;
  const requestedSlotText = availability.requestedTime
    ? formatDateTimeWindow(
        availability.requestedTime.start,
        availability.requestedTime.end,
      )
    : "";

  return (
    <div className="space-y-3.5">
      {/* Container Header */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">
          MailPoint AI
        </div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
            Calendar Availability
          </h3>
          <span
            className={
              isAvailable
                ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500"
                : "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500"
            }
          >
            {isAvailable ? (
              <>
                <CheckCircle2 className="size-3.5" />
                Available
              </>
            ) : (
              <>
                <AlertTriangle className="size-3.5" />
                Conflict Detected
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Status Box */}
      <div
        className={
          isAvailable
            ? "rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5"
            : "rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5"
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              isAvailable
                ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500"
                : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500"
            }
          >
            {isAvailable ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="font-semibold text-foreground text-sm sm:text-base">
              {isAvailable
                ? "You are free at this time!"
                : "This requested time has a conflict."}
            </h4>

            {requestedSlotText && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground pt-0.5">
                <Clock className="size-3.5 text-primary shrink-0" />
                <span>Requested slot: {requestedSlotText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Conflicts list */}
        {availability.conflicts && availability.conflicts.length > 0 && (
          <div className="mt-4 space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
            <div className="font-semibold text-amber-600 dark:text-amber-400">
              Conflicting Event(s):
            </div>
            <ul className="space-y-1 text-muted-foreground">
              {availability.conflicts.map((conflict, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  <span>
                    {conflict.summary ?? "Existing Calendar Event"} (
                    {formatDateTimeWindow(conflict.start, conflict.end)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Suggested Alternatives */}
      {availability.suggestedAlternatives &&
        availability.suggestedAlternatives.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-muted/15 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Calendar className="size-3.5 text-primary" />
              <span>Recommended Alternative Free Slots</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {availability.suggestedAlternatives.map((alt, idx) => {
                const slotText = formatDateTimeWindow(alt.start, alt.end);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onScheduleSlot?.(alt)}
                    className="group flex items-center justify-between rounded-lg border border-border/70 bg-card p-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 text-foreground font-medium truncate">
                      <Clock className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="truncate">{slotText}</span>
                    </div>
                    {onScheduleSlot && (
                      <PlusCircle className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}
