"use client";

import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  RotateCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import type { Message } from "@/app/_components/agent/types";
import type { AgentConfirmation } from "@/lib/agent-types";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { AgentConfirmationCard } from "./agent-confirmation-card";
import { AgentMarkdown } from "./agent-markdown";
import { AgentAvailabilityCard } from "./presentation/agent-availability-card";
import { AgentCalendarContainer } from "./presentation/agent-calendar-container";
import { AgentEmailContainer } from "./presentation/agent-email-container";
import { AgentEmptyCard } from "./presentation/agent-empty-card";
import { AgentErrorCard } from "./presentation/agent-error-card";
import { detectAgentResponse } from "./presentation/response-detector";

function formatMessageTime(isoString?: string): string {
  if (!isoString) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  }
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "";
  }
}

export function AgentMessage({
  message,
  onConfirmationUpdate,
  onRegenerate,
}: {
  message: Message;
  onConfirmationUpdate?: (
    messageId: string,
    updated: AgentConfirmation,
    outcomeMessage?: string,
  ) => void;
  onRegenerate?: (prompt: string) => void;
}) {
  const { data: session } = authClient.useSession();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const timeStr = formatMessageTime(message.createdAt);

  if (message.role === "user") {
    const userInitials = session?.user?.name
      ? session.user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "U";

    return (
      <div className="flex flex-col items-end gap-1 px-1">
        <div className="flex items-center gap-2">
          {/* User message bubble matching reference design */}
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-normal text-primary-foreground shadow-sm">
            <span>{message.content}</span>
            <ChevronDown className="size-3.5 opacity-70" />
          </div>

          {/* User Avatar */}
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "User"}
              className="size-8 rounded-full border border-border object-cover select-none shrink-0"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary border border-primary/30 select-none">
              {userInitials}
            </div>
          )}
        </div>

        {/* Timestamp */}
        {timeStr && (
          <span className="text-[11px] text-muted-foreground pr-10">
            {timeStr}
          </span>
        )}
      </div>
    );
  }

  // Assistant response
  const parsed = detectAgentResponse(message.content, message.structuredData);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="flex items-start gap-3">
        {/* Assistant Bot Icon matching reference design */}
        <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-sm">
          <Bot className="size-4" />
        </div>

        {/* Main Response Container */}
        <div className="min-w-0 flex-1 rounded-2xl border border-border/80 bg-card/95 dark:border-white/10 dark:bg-[#11161d]/90 p-4 sm:p-6 shadow-sm backdrop-blur-md">
          {/* Render structured response based on detected type */}
          {parsed.type === "email-list" && parsed.emails ? (
            <AgentEmailContainer
              title={parsed.title}
              subtitle={parsed.subtitle}
              countBadge={parsed.countBadge}
              emails={parsed.emails}
              bottomAction={parsed.bottomAction}
            />
          ) : parsed.type === "calendar-list" && parsed.events ? (
            <AgentCalendarContainer
              title={parsed.title}
              subtitle={parsed.subtitle}
              countBadge={parsed.countBadge}
              events={parsed.events}
              bottomAction={parsed.bottomAction}
            />
          ) : parsed.type === "availability" && parsed.availability ? (
            <AgentAvailabilityCard availability={parsed.availability} />
          ) : parsed.type === "empty" ? (
            <AgentEmptyCard
              title={parsed.title}
              message={parsed.emptyMessage}
              followUpText={parsed.followUpText}
            />
          ) : parsed.type === "error" ? (
            <AgentErrorCard
              title={parsed.title}
              message={parsed.errorMessage ?? message.content}
            />
          ) : (
            // Conversational text or fallback markdown table
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="size-3" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    MailPoint AI
                  </span>
                </div>
                <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  AI response
                </span>
              </div>
              <AgentMarkdown content={message.content} />
            </div>
          )}

          {/* Pending confirmation card if scheduled */}
          {message.confirmation && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <AgentConfirmationCard
                confirmation={message.confirmation}
                onStatusChange={(updated, outcomeMessage) =>
                  onConfirmationUpdate?.(message.id, updated, outcomeMessage)
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Sparkles Row & Interactive Controls matching reference design */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-12 pr-1 text-xs text-muted-foreground">
        {/* Left: Sparkles text */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span className="truncate">
            {parsed.followUpText ??
              "Let me know if you'd like to open an email, search for something, or take any action."}
          </span>
        </div>

        {/* Right: Timestamp and Action Icons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {timeStr && <span className="text-[11px] opacity-80">{timeStr}</span>}

          <div className="flex items-center gap-1">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy response"
              aria-label="Copy response"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>

            {/* Regenerate Button */}
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.content)}
                title="Regenerate"
                aria-label="Regenerate"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCw className="size-3" />
              </button>
            )}

            {/* Thumbs Up Button */}
            <button
              type="button"
              onClick={() => setFeedback(feedback === "up" ? null : "up")}
              title="Good response"
              aria-label="Good response"
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground",
                feedback === "up"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground",
              )}
            >
              <ThumbsUp className="size-3" />
            </button>

            {/* Thumbs Down Button */}
            <button
              type="button"
              onClick={() => setFeedback(feedback === "down" ? null : "down")}
              title="Poor response"
              aria-label="Poor response"
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground",
                feedback === "down"
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground",
              )}
            >
              <ThumbsDown className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
