"use client";

import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { useState } from "react";
import type { EmailItem } from "@/lib/agent-types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AgentBrandAvatar } from "./agent-brand-avatar";

export function AgentEmailModal({
  email,
  open,
  onOpenChange,
}: {
  email: EmailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!email) return null;

  const senderName = email.fromName ?? email.from ?? "Unknown";
  const senderEmail = email.fromEmail ?? "";

  const handleCopy = async () => {
    try {
      const textToCopy = `Subject: ${email.subject ?? ""}\nFrom: ${senderName} <${senderEmail}>\nDate: ${email.date ?? ""} ${email.time ?? ""}\n\n${email.snippet ?? ""}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpenGmail = () => {
    const query = email.id ?? email.subject ?? "";
    window.open(
      `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border bg-card p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border/80 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Mail className="size-4 text-primary" />
            <span>Email Details</span>
          </div>
          <SheetTitle className="mt-2 text-base font-bold text-foreground">
            {email.subject ?? "(No Subject)"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Email preview and actions
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Sender row */}
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <AgentBrandAvatar
              name={senderName}
              email={senderEmail}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                {senderName}
              </div>
              {senderEmail && (
                <div className="text-xs text-muted-foreground truncate">
                  {senderEmail}
                </div>
              )}
              {(email.date ?? email.time) && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {email.date} {email.time && `· ${email.time}`}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {email.tags && email.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {email.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Snippet / Content */}
          <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
            <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Message Preview
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {email.snippet ?? "No preview available for this message."}
            </p>
          </div>
        </div>

        {/* Modal actions */}
        <div className="border-t border-border/80 bg-muted/20 p-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy details
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenGmail}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <ExternalLink className="size-3.5" />
            Open in Gmail
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
