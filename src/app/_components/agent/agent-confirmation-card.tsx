"use client";

import { useState } from "react";
import { Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postConfirmation } from "@/lib/agent-client";
import type { AgentConfirmation } from "@/lib/agent-types";

function formatEventTime(startStr: string, endStr: string, timeZone?: string) {
  try {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timeZone ?? undefined,
    }).format(startDate);

    const startTimeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone ?? undefined,
    }).format(startDate);

    const endTimeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timeZone ?? undefined,
    }).format(endDate);

    return `${dateFormatted} · ${startTimeFormatted} – ${endTimeFormatted}`;
  } catch {
    return `${startStr} – ${endStr}`;
  }
}

export function AgentConfirmationCard({
  confirmation,
  onStatusChange,
}: {
  confirmation: AgentConfirmation;
  onStatusChange?: (updated: AgentConfirmation) => void;
}) {
  const [status, setStatus] = useState(confirmation.status);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { proposal } = confirmation;

  const handleConfirm = async () => {
    if (isLoading || status !== "pending") return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await postConfirmation(confirmation.token, "confirm");
      if (res.success && res.status === "confirmed") {
        setStatus("confirmed");
        const updated: AgentConfirmation = {
          ...confirmation,
          status: "confirmed",
        };
        onStatusChange?.(updated);
      } else {
        setError(res.message || "Failed to confirm event creation.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to confirm event.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (isLoading || status !== "pending") return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await postConfirmation(confirmation.token, "cancel");
      if (res.success && res.status === "cancelled") {
        setStatus("cancelled");
        const updated: AgentConfirmation = {
          ...confirmation,
          status: "cancelled",
        };
        onStatusChange?.(updated);
      } else {
        setError(res.message || "Failed to cancel proposal.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel proposal.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b pb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Calendar className="size-4 text-primary" />
        <span>Create calendar event?</span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="text-base font-semibold leading-snug text-foreground">
          {proposal.summary}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span>
            {formatEventTime(
              proposal.start.dateTime,
              proposal.end.dateTime,
              proposal.start.timeZone,
            )}
          </span>
        </div>

        {proposal.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span>{proposal.location}</span>
          </div>
        )}

        {proposal.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {proposal.description}
          </p>
        )}

        {proposal.attendees && proposal.attendees.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5 shrink-0" />
            <span>
              {proposal.attendees.map((a) => a.displayName ?? a.email).join(", ")}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {status === "pending" && (
        <div className="mt-4 flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className="h-8 px-4 text-xs font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Scheduling...
              </>
            ) : (
              "Confirm"
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="h-8 px-3 text-xs font-medium"
          >
            Cancel
          </Button>
        </div>
      )}

      {status === "confirmed" && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          <span>Calendar event scheduled successfully!</span>
        </div>
      )}

      {status === "cancelled" && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          <XCircle className="size-4" />
          <span>Calendar event was cancelled.</span>
        </div>
      )}
    </div>
  );
}
