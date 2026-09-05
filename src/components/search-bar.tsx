"use client";

import * as React from "react";
import {
  HelpCircle,
  Lightbulb,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchMode } from "@/server/lib/email-search";

export type PriorityFilterOption = "all" | "urgent" | "important" | "normal" | "low" | "high";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  priorityFilter: PriorityFilterOption;
  onPriorityFilterChange: (priority: PriorityFilterOption) => void;
  isSearching?: boolean;
  className?: string;
}

const SEARCH_OPERATORS = [
  { operator: "from:", desc: "Filter by sender", example: "from:rahul@example.com" },
  { operator: "to:", desc: "Filter by recipient", example: "to:team@mailpoint.com" },
  { operator: "subject:", desc: "Filter by subject line", example: "subject:interview" },
  { operator: "priority:urgent", desc: "Filter urgent emails", example: "priority:urgent" },
  { operator: "priority:important", desc: "Filter important emails", example: "priority:important" },
  { operator: "is:unread", desc: "Unread emails only", example: "is:unread" },
  { operator: "is:starred", desc: "Starred emails only", example: "is:starred" },
  { operator: "after:", desc: "Received after date", example: "after:2026/09/01" },
];

const NATURAL_LANGUAGE_EXAMPLES = [
  "emails about my interview",
  "flight confirmation emails",
  "account update messages",
  "urgent server outage alerts",
  "meeting schedule proposals",
];

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  mode,
  onModeChange,
  priorityFilter,
  onPriorityFilterChange,
  isSearching = false,
  className,
}: SearchBarProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close popover when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOperatorClick = (operatorText: string) => {
    const trimmed = value.trim();
    const newValue = trimmed ? `${trimmed} ${operatorText}` : operatorText;
    onChange(newValue);
    inputRef.current?.focus();
  };

  const handleNaturalExampleClick = (example: string) => {
    onChange(example);
    onModeChange("hybrid");
    setPopoverOpen(false);
    setTimeout(() => onSubmit(), 50);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-xl", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPopoverOpen(false);
          onSubmit();
        }}
        className="relative flex items-center"
      >
        <Search className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setPopoverOpen(true)}
          placeholder={
            mode === "semantic"
              ? "Ask in natural language (e.g. 'interview feedback')..."
              : mode === "keyword"
                ? "Search emails or use from:, subject:, priority:..."
                : "Search keywords, natural queries, or filters..."
          }
          className="border-input bg-muted/40 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 h-9 w-full rounded-lg border pr-24 pl-9 text-xs sm:text-sm focus:ring-2 focus:outline-none transition-all shadow-xs"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded text-xs"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Help trigger */}
          <button
            type="button"
            onClick={() => setPopoverOpen((prev) => !prev)}
            className={cn(
              "text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              popoverOpen && "bg-muted text-foreground",
            )}
            title="Search guidance and operators"
            aria-label="Search guidance"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* Popover Menu with Syntax Guidance, Modes, and Filters */}
      {popoverOpen && (
        <div className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1.5 w-full rounded-xl border shadow-lg animate-in fade-in-0 zoom-in-95 p-3">
          {/* Mode Switcher */}
          <div className="border-b pb-2.5 mb-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Search Mode
              </span>
              <span className="text-[11px] text-muted-foreground">
                AI + Keyword Intelligence
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onModeChange("hybrid")}
                className={cn(
                  "flex flex-col items-start rounded-md border p-1.5 text-left text-xs transition-colors",
                  mode === "hybrid"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/60 hover:bg-muted/60 text-muted-foreground",
                )}
              >
                <span className="font-semibold text-[11px]">Hybrid</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  Keyword + Semantic
                </span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("semantic")}
                className={cn(
                  "flex flex-col items-start rounded-md border p-1.5 text-left text-xs transition-colors",
                  mode === "semantic"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/60 hover:bg-muted/60 text-muted-foreground",
                )}
              >
                <span className="font-semibold text-[11px]">Semantic</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  Meaning-based AI
                </span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("keyword")}
                className={cn(
                  "flex flex-col items-start rounded-md border p-1.5 text-left text-xs transition-colors",
                  mode === "keyword"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/60 hover:bg-muted/60 text-muted-foreground",
                )}
              >
                <span className="font-semibold text-[11px]">Keyword</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  Exact text & syntax
                </span>
              </button>
            </div>
          </div>

          {/* Priority Quick Filter */}
          <div className="border-b pb-2.5 mb-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">
                Priority Filter
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "high", label: "High (Urgent & Important)" },
                  { id: "urgent", label: "Urgent" },
                  { id: "important", label: "Important" },
                  { id: "normal", label: "Normal" },
                  { id: "low", label: "Low" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPriorityFilterChange(p.id)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] border transition-colors",
                    priorityFilter === p.id
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Natural Language Suggestions */}
          <div className="border-b pb-2.5 mb-2.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Natural Language Queries
            </span>
            <div className="flex flex-wrap gap-1.5">
              {NATURAL_LANGUAGE_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleNaturalExampleClick(example)}
                  className="rounded-md bg-muted/60 hover:bg-muted px-2 py-0.5 text-[11px] text-foreground transition-colors"
                >
                  &ldquo;{example}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Operators */}
          <div>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
              <Tag className="h-3.5 w-3.5 text-blue-500" />
              Search Operators
            </span>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {SEARCH_OPERATORS.map((item) => (
                <button
                  key={item.operator}
                  type="button"
                  onClick={() => handleOperatorClick(item.operator)}
                  className="flex items-center justify-between rounded-md border border-border/50 hover:bg-muted px-1.5 py-1 text-[11px] text-left transition-colors"
                  title={item.desc}
                >
                  <code className="font-semibold text-primary">{item.operator}</code>
                  <span className="text-[10px] text-muted-foreground truncate ml-1">
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Action footer in popover */}
          <div className="mt-3 pt-2 border-t flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Press <kbd className="rounded border px-1 py-0.5 text-[10px]">Enter</kbd> to search
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setPopoverOpen(false);
                onSubmit();
              }}
              disabled={isSearching}
              className="h-7 text-xs px-2.5"
            >
              Search
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
