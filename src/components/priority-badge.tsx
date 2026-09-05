"use client";

import * as React from "react";
import { AlertTriangle, Bookmark, Check, Flame, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PriorityType = "urgent" | "important" | "normal" | "low" | "analyzing";

interface PriorityBadgeProps {
  priority: PriorityType;
  confidence?: number;
  reason?: string;
  category?: string | null;
  size?: "sm" | "md";
  showReasonTooltip?: boolean;
  className?: string;
}

const PRIORITY_CONFIG: Record<
  PriorityType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  urgent: {
    label: "Urgent",
    icon: Flame,
    className:
      "bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 font-semibold",
  },
  important: {
    label: "Important",
    icon: Bookmark,
    className:
      "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-medium",
  },
  normal: {
    label: "Normal",
    icon: Check,
    className:
      "bg-muted/80 text-muted-foreground border border-border/50 hover:bg-muted font-normal",
  },
  low: {
    label: "Low",
    icon: AlertTriangle,
    className:
      "bg-slate-500/10 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400 border border-slate-500/20 hover:bg-slate-500/20 font-normal",
  },
  analyzing: {
    label: "Analyzing...",
    icon: Loader2,
    className:
      "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 animate-pulse font-normal",
  },
};

export function PriorityBadge({
  priority,
  confidence,
  reason,
  category,
  size = "sm",
  showReasonTooltip = true,
  className,
}: PriorityBadgeProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.normal;
  const Icon = config.icon;

  const confidencePct =
    typeof confidence === "number" ? Math.round(confidence * 100) : null;

  const tooltipContent = (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
        <span className="font-semibold capitalize text-foreground flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" />
          {config.label} Priority
        </span>
        {confidencePct !== null && (
          <span className="text-muted-foreground text-[10px]">
            {confidencePct}% confidence
          </span>
        )}
      </div>
      {category && (
        <div className="text-[11px] text-muted-foreground">
          Category: <span className="font-medium text-foreground">{category}</span>
        </div>
      )}
      {reason && (
        <p className="text-muted-foreground leading-snug mt-0.5 max-w-[220px]">
          {reason}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Badge
        className={cn(
          "transition-colors select-none",
          config.className,
          size === "sm" && "h-5 text-[11px] px-1.5 py-0 gap-1",
          size === "md" && "h-6 text-xs px-2.5 py-0.5 gap-1.5",
          className,
        )}
        aria-label={`${config.label} priority ${confidencePct ? `(${confidencePct}% confidence)` : ""}`}
      >
        <Icon
          className={cn(
            size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
            priority === "analyzing" && "animate-spin",
          )}
        />
        <span>{config.label}</span>
      </Badge>

      {/* Tooltip Popover */}
      {showReasonTooltip && showTooltip && (Boolean(reason) || confidencePct !== null) && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-max max-w-xs rounded-lg border bg-popover p-2.5 shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none"
        >
          {tooltipContent}
        </div>
      )}
    </div>
  );
}
