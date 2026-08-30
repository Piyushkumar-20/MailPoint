import { CalendarDays, Mail, Search, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const suggestions = [
  {
    label: "Show my latest 5 emails",
    prompt: "Show my latest 5 emails.",
    icon: Mail,
  },
  {
    label: "What events do I have this week?",
    prompt: "What events do I have this week?",
    icon: CalendarDays,
  },
  {
    label: "Find emails about Testing Phase 3",
    prompt: "Find emails about Testing Phase 3.",
    icon: Search,
  },
  {
    label: "What is my next meeting?",
    prompt: "What is my next meeting?",
    icon: CalendarDays,
  },
  {
    label: "Find the latest Testing Phase 3 email and related calendar event",
    prompt:
      "Find my latest email about Testing Phase 3 and check whether I have a calendar event for it.",
    icon: Sparkles,
  },
];

export function AgentEmptyState({
  onSuggestion,
  disabled,
}: {
  onSuggestion: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-lg">
          <Sparkles className="size-5" />
        </div>

        <h2 className="font-heading text-2xl font-semibold">How can I help?</h2>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
          Ask MailPoint to find emails, check your calendar, or help you manage
          your Gmail and Google Calendar workspace.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.prompt}
              type="button"
              onClick={() => onSuggestion(suggestion.prompt)}
              disabled={disabled}
              className={cn(
                "group bg-card text-card-foreground flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left shadow-sm transition-colors",
                "hover:border-primary/40 hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                index === suggestions.length - 1 && "sm:col-span-2",
              )}
            >
              <span className="bg-primary/10 text-primary group-hover:bg-primary/15 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                <Icon className="size-4" />
              </span>
              <span className="pt-0.5 text-sm leading-5 font-medium">
                {suggestion.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
