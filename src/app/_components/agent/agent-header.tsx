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
    <div className="bg-background/95 border-b px-3 py-3 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Bot className="size-4" />
          </div>

          <div className="min-w-0">
            <h2 className="font-heading truncate text-base font-semibold">
              MailPoint AI
            </h2>
            <p className="text-muted-foreground truncate text-xs">
              Your intelligent Gmail & Calendar assistant
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="text-muted-foreground hidden items-center gap-1.5 rounded-full border px-2 py-1 text-xs sm:inline-flex"
            aria-live="polite"
          >
            <Circle
              className={cn(
                "size-2 fill-current",
                isLoading ? "text-muted-foreground" : "text-emerald-500",
              )}
            />
            {isLoading ? "Working" : "Ready"}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            disabled={!hasMessages || isLoading}
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
