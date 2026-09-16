"use client";

import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MailPointAiIcon } from "./mailpoint-ai-icon";

export function AgentHeader({
  hasMessages,
  isLoading,
  onNewConversation,
}: {
  hasMessages: boolean;
  isLoading: boolean;
  onNewConversation: () => void;
}) {
  return (
    <div className="border-b border-border/70 bg-background/95 px-3 py-2.5 sm:px-6 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        {/* Left: AI Brand Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-xs dark:border-blue-800/40 dark:bg-blue-950/40">
            <MailPointAiIcon className="size-5 text-primary dark:text-sky-400" />
          </div>

          <div className="min-w-0">
            <h2 className="font-heading truncate text-sm sm:text-base font-bold text-foreground">
              MailPoint AI
            </h2>
            <p className="text-muted-foreground truncate text-xs">
              Your intelligent Gmail & Calendar assistant
            </p>
          </div>
        </div>

        {/* Right: Status badge & New conversation button */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium select-none",
              isLoading
                ? "border-border/70 bg-muted/40 text-muted-foreground"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
            aria-live="polite"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isLoading ? "bg-muted-foreground animate-pulse" : "bg-emerald-500",
              )}
            />
            <span>{isLoading ? "Working..." : "Ready"}</span>
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            disabled={!hasMessages || isLoading}
            className="h-8 gap-1.5 rounded-xl border-border/80 bg-background/60 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">New conversation</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
