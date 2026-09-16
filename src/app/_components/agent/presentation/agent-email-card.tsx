"use client";

import { ExternalLink, Mail } from "lucide-react";
import type { EmailItem } from "@/lib/agent-types";
import { Button } from "@/components/ui/button";
import { AgentBrandAvatar } from "./agent-brand-avatar";

export function AgentEmailCard({
  email,
  index,
  onOpen,
}: {
  email: EmailItem;
  index: number;
  onOpen: (email: EmailItem) => void;
}) {
  const senderName = email.fromName ?? email.from ?? "Unknown";
  const senderEmail = email.fromEmail ?? "";

  const handleExternalOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = email.id;
    const isRealGmailId =
      typeof id === "string" &&
      id.length >= 10 &&
      /^[a-zA-Z0-9_-]+$/.test(id) &&
      !id.startsWith("email-");

    const url = isRealGmailId
      ? `https://mail.google.com/mail/u/0/#all/${id}`
      : email.subject
        ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(email.subject)}`
        : "https://mail.google.com/mail/u/0/#inbox";

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className="group relative rounded-xl border border-border/80 bg-muted/15 p-3.5 sm:p-4 transition-all duration-150 hover:border-border hover:bg-muted/30 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/15 dark:hover:bg-zinc-900/80 shadow-xs"
      tabIndex={0}
      role="region"
      aria-label={`Email ${index + 1} from ${senderName}: ${email.subject}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(email);
        }
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left column: Number + Avatar + Content */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Result Number Box */}
          <div
            className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-xs font-semibold text-muted-foreground select-none"
            aria-hidden="true"
          >
            {index + 1}
          </div>

          {/* Avatar */}
          <AgentBrandAvatar
            name={senderName}
            email={senderEmail}
            size="md"
            className="mt-0.5"
          />

          {/* Main Info */}
          <div className="min-w-0 flex-1 space-y-1">
            {/* Sender Name & Email */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-semibold text-foreground text-sm">
                {senderName}
              </span>
              {senderEmail && (
                <span className="text-muted-foreground truncate max-w-[200px] sm:max-w-[320px]">
                  {senderEmail}
                </span>
              )}
            </div>

            {/* Subject */}
            <h4 className="font-semibold text-foreground text-sm leading-snug line-clamp-1">
              {email.subject ?? "(No Subject)"}
            </h4>

            {/* Snippet */}
            {email.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-1 leading-normal">
                {email.snippet}
              </p>
            )}

            {/* Tags */}
            {email.tags && email.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {email.tags.map((tag, tagIndex) => {
                  const isPrimaryTag = tagIndex === 0;
                  return (
                    <span
                      key={tag}
                      className={
                        isPrimaryTag
                          ? "rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                          : "rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      }
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Date/Time + Action Buttons */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 shrink-0 border-t border-border/40 sm:border-0">
          {/* Date & Time */}
          {(email.date ?? email.time) && (
            <div className="text-left sm:text-right text-xs text-muted-foreground leading-tight space-y-0.5">
              {email.date && <div className="font-medium">{email.date}</div>}
              {email.time && <div className="text-[11px] opacity-80">{email.time}</div>}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpen(email)}
              aria-label={`Open email: ${email.subject}`}
              className="h-8 gap-1.5 px-3 rounded-lg text-xs font-medium border-border/80 bg-background/80 hover:bg-accent transition-colors"
            >
              <Mail className="size-3.5" />
              <span>Open</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleExternalOpen}
              aria-label={`Open in Gmail: ${email.subject ?? "this email"}`}
              title="Open in Gmail"
              className="size-8 rounded-lg border-border/80 bg-background/80 hover:bg-accent transition-colors"
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
