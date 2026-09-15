"use client";

import { AlertCircle, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AgentErrorCard({
  title = "Something went wrong",
  message = "MailPoint encountered an issue while processing your request.",
  technicalDetails,
  onRetry,
}: {
  title?: string;
  message?: string;
  technicalDetails?: string;
  onRetry?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  // Clean friendly user message
  let friendlyTitle = title;
  let friendlyMessage = message;

  const lower = message.toLowerCase();
  if (lower.includes("token") || lower.includes("auth") || lower.includes("unauthorized")) {
    friendlyTitle = "Gmail / Calendar Authorization Required";
    friendlyMessage = "Your Google integration session has expired or requires authorization. Please reconnect your account in Integrations.";
  } else if (lower.includes("daily limit") || lower.includes("quota")) {
    friendlyTitle = "Daily AI Limit Reached";
    friendlyMessage = "You have reached the daily quota for AI queries. Please upgrade to Pro for unlimited access.";
  } else if (lower.includes("credits") || lower.includes("503")) {
    friendlyTitle = "Service Temporarily Unavailable";
    friendlyMessage = "The AI service is experiencing high traffic or temporary downtime. Please try again in a moment.";
  } else if (lower.includes("size limit") || lower.includes("413")) {
    friendlyTitle = "Request Too Large";
    friendlyMessage = "The query or email thread contains too much data to process at once. Please try a more specific question.";
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3 dark:border-destructive/20 dark:bg-destructive/10">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
          <AlertCircle className="size-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="font-semibold text-foreground text-sm">
            {friendlyTitle}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {friendlyMessage}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-destructive/15">
        {technicalDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Technical details</span>
            {showDetails ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        ) : (
          <div />
        )}

        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 gap-1 px-2.5 text-xs font-medium"
          >
            <RefreshCcw className="size-3" />
            <span>Try again</span>
          </Button>
        )}
      </div>

      {showDetails && technicalDetails && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[10px] text-destructive-foreground/90 whitespace-pre-wrap">
          {technicalDetails}
        </pre>
      )}
    </div>
  );
}
