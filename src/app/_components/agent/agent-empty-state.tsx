"use client";

import { ArrowRight, Calendar, Mail, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MailPointAiIcon } from "./mailpoint-ai-icon";

interface SuggestionCard {
  title: string;
  description: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
  iconStyles: string;
}

const suggestionCards: SuggestionCard[] = [
  {
    title: "Show my latest emails",
    description: "Fetch and summarize your recent emails",
    prompt: "Show my latest emails",
    icon: Mail,
    iconStyles:
      "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    title: "What events do I have today?",
    description: "See your meetings and upcoming events",
    prompt: "What events do I have today?",
    icon: Calendar,
    iconStyles:
      "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    title: "Find emails about a project",
    description: "Search your inbox with context",
    prompt: "Find emails about a project",
    icon: Search,
    iconStyles:
      "border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    title: "Find a time I'm available",
    description: "Check your availability and suggest a time",
    prompt: "Find a time I'm available",
    icon: Sparkles,
    iconStyles:
      "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

const promptChips = [
  {
    label: "'Find my unread emails'",
    prompt: "Find my unread emails",
  },
  {
    label: '"What\'s on my calendar tomorrow?"',
    prompt: "What's on my calendar tomorrow?",
  },
  {
    label: "'Find the email about Testing Phase 3'",
    prompt: "Find the email about Testing Phase 3",
  },
  {
    label: "When am I free this week?",
    prompt: "When am I free this week?",
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
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center px-4 py-8 sm:py-12">
      {/* Centered AI Icon */}
      <div className="mb-5 flex size-14 sm:size-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-xs dark:border-blue-800/40 dark:bg-blue-950/40">
        <MailPointAiIcon className="size-7 sm:size-8 text-primary dark:text-sky-400" />
      </div>

      {/* Hero Headings */}
      <div className="text-center space-y-2">
        <h1 className="font-heading text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
          Your inbox. Your calendar.
          <span className="block mt-1 text-primary dark:text-sky-400">
            One conversation.
          </span>
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto leading-relaxed pt-1">
          Ask MailPoint to find emails, check your calendar,
          <br className="hidden sm:inline" /> or handle your workflow.
        </p>
      </div>

      {/* Four Suggestion Cards (2x2 on desktop, 1 column on mobile) */}
      <div className="mt-8 grid w-full max-w-3xl grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
        {suggestionCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              type="button"
              onClick={() => onSuggestion(card.prompt)}
              disabled={disabled}
              className={cn(
                "group flex items-center justify-between gap-3.5 rounded-xl border border-border/80 bg-card/70 p-3.5 sm:p-4 text-left shadow-xs transition-all duration-150",
                "hover:border-primary/40 hover:bg-card dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/20 dark:hover:bg-zinc-900/80",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={cn(
                    "flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-lg border transition-transform duration-150 group-hover:scale-105",
                    card.iconStyles,
                  )}
                >
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {card.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 leading-normal">
                    {card.description}
                  </p>
                </div>
              </div>

              <ArrowRight className="size-4 shrink-0 text-muted-foreground/60 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          );
        })}
      </div>

      {/* "Try asking" Divider */}
      <div className="flex items-center justify-center gap-3 w-full max-w-3xl my-6 text-xs text-muted-foreground">
        <div className="h-px bg-border/60 flex-1" />
        <span className="font-medium px-2 select-none">Try asking</span>
        <div className="h-px bg-border/60 flex-1" />
      </div>

      {/* Prompt Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-3xl">
        {promptChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSuggestion(chip.prompt)}
            disabled={disabled}
            className={cn(
              "rounded-full border border-border/80 bg-card/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-all duration-150 shadow-2xs",
              "hover:border-border hover:bg-muted/60 hover:text-foreground dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/20 dark:hover:bg-zinc-900/80",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
