"use client";

import { Bot, Circle, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    <div className="border-b border-border/80 bg-background/95 px-3 py-3 md:px-6 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-xs">
            <Bot className="size-[18px]" />
          </div>

          <div className="min-w-0">
            <h2 className="font-heading truncate text-base font-bold text-foreground">
              MailPoint AI
            </h2>
            <p className="text-muted-foreground truncate text-xs">
              Your intelligent Gmail & Calendar assistant
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex",
              isLoading
                ? "border-border/70 bg-muted/40 text-muted-foreground"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
            aria-live="polite"
          >
            <Circle
              className={cn(
                "size-2 fill-current",
                isLoading ? "text-muted-foreground animate-pulse" : "text-emerald-500",
              )}
            />
            {isLoading ? "Working..." : "Ready"}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            disabled={!hasMessages || isLoading}
            className="h-8 gap-1.5 rounded-xl border-border/80 text-xs font-medium hover:bg-accent"
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
