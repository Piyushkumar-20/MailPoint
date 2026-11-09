"use client";

import { CalendarDays, Mail, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MailPointAiIcon } from "./mailpoint-ai-icon";

const suggestions = [
  { label: "Catch up on my inbox", prompt: "Show my latest emails", icon: Mail },
  { label: "What's on my calendar?", prompt: "What events do I have today?", icon: CalendarDays },
  { label: "Find an email", prompt: "Find emails about a project", icon: Search },
  { label: "Plan a meeting", prompt: "Find a time I'm available", icon: Sparkles },
];

export function AgentEmptyState({
  onSuggestion,
  disabled,
}: {
  onSuggestion: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-h-full w-full items-center justify-center px-5 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <div className="mb-7 flex size-11 items-center justify-center rounded-2xl border border-brand/20 bg-brand/[0.07] text-brand">
          <MailPointAiIcon className="size-5" />
        </div>

        <h1 className="font-heading text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-[2.7rem]">
          How can I help?
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-[15px]">
          Ask MailPoint to find something in your email or help you manage your calendar.
        </p>

        <div className="mt-9 flex w-full flex-wrap items-center justify-center gap-2.5">
          {suggestions.map(({ label, prompt, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => onSuggestion(prompt)}
              disabled={disabled}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border border-border/80 bg-card/70 px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors",
                "hover:border-brand/35 hover:bg-accent/70 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <Icon className="size-3.5 shrink-0 text-brand" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
