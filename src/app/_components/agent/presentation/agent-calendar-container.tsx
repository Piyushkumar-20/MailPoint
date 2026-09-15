"use client";

import { Calendar, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CalendarEventItem } from "@/lib/agent-types";
import { AgentCalendarCard } from "./agent-calendar-card";

export function AgentCalendarContainer({
  title = "Here are your scheduled events",
  subtitle = "Events scheduled on your Google Calendar",
  countBadge,
  events = [],
  bottomAction = {
    label: "Open Calendar in MailPoint",
    actionType: "open-calendar",
  },
}: {
  title?: string;
  subtitle?: string;
  countBadge?: string;
  events: CalendarEventItem[];
  bottomAction?: {
    label: string;
    actionType: "view-inbox" | "open-calendar" | "custom";
    href?: string;
  };
}) {
  const router = useRouter();

  const handleBottomAction = () => {
    if (bottomAction.actionType === "open-calendar") {
      router.push("/calendar");
    } else if (bottomAction.href) {
      window.open(bottomAction.href, "_blank", "noopener,noreferrer");
    } else {
      window.open("https://calendar.google.com", "_blank", "noopener,noreferrer");
    }
  };

  const badgeText = countBadge ?? `${events.length} events`;

  return (
    <div className="space-y-3.5">
      {/* Container Header */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">
          MailPoint AI
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
            {title}
          </h3>

          <div className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>{badgeText}</span>
          </div>
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Calendar Result Cards */}
      <div className="space-y-2.5">
        {events.map((event, index) => (
          <AgentCalendarCard
            key={event.id ?? `cal-${index}`}
            event={event}
            index={index}
          />
        ))}
      </div>

      {/* Bottom Action Bar */}
      {bottomAction && (
        <button
          type="button"
          onClick={handleBottomAction}
          className="group flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left transition-all hover:border-border hover:bg-muted/40 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/15 dark:hover:bg-zinc-900/70"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-foreground">
            <Calendar className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>{bottomAction.label}</span>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-all" />
        </button>
      )}
    </div>
  );
}
