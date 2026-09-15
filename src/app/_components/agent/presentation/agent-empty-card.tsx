"use client";

import { Inbox, Search } from "lucide-react";

export function AgentEmptyCard({
  title = "No results found",
  message = "No matching items were found in your Gmail or Calendar.",
  followUpText = "Try adjusting your query or date range, or ask something else.",
}: {
  title?: string;
  message?: string;
  followUpText?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/15 p-6 text-center space-y-3 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Inbox className="size-6" />
      </div>

      <div className="space-y-1">
        <h4 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h4>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          {message}
        </p>
      </div>

      {followUpText && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
          <Search className="size-3 text-primary" />
          <span>{followUpText}</span>
        </div>
      )}
    </div>
  );
}
