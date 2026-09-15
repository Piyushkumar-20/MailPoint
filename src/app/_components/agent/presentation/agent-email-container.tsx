"use client";

import { ChevronRight, ListOrdered, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EmailItem } from "@/lib/agent-types";
import { AgentEmailCard } from "./agent-email-card";
import { AgentEmailModal } from "./agent-email-modal";

export function AgentEmailContainer({
  title = "Here are your emails",
  subtitle = "Your latest messages from Gmail, sorted by newest first.",
  countBadge,
  emails = [],
  bottomAction = {
    label: "View all emails in Gmail",
    actionType: "view-inbox",
  },
}: {
  title?: string;
  subtitle?: string;
  countBadge?: string;
  emails: EmailItem[];
  bottomAction?: {
    label: string;
    actionType: "view-inbox" | "open-calendar" | "custom";
    href?: string;
  };
}) {
  const router = useRouter();
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenEmail = (email: EmailItem) => {
    setSelectedEmail(email);
    setModalOpen(true);
  };

  const handleBottomAction = () => {
    if (bottomAction.actionType === "view-inbox") {
      router.push("/mail/inbox");
    } else if (bottomAction.href) {
      window.open(bottomAction.href, "_blank", "noopener,noreferrer");
    } else {
      window.open("https://mail.google.com/mail/u/0/#inbox", "_blank", "noopener,noreferrer");
    }
  };

  const badgeText = countBadge ?? `${emails.length} emails`;

  return (
    <div className="space-y-3.5">
      {/* Container Header */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground">
          MailPoint AI
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
            {title}
          </h3>

          <div className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Mail className="size-3.5 text-primary" />
            <span>{badgeText}</span>
          </div>
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Email Result Cards */}
      <div className="space-y-2.5">
        {emails.map((email, index) => (
          <AgentEmailCard
            key={email.id ?? `email-${index}`}
            email={email}
            index={index}
            onOpen={handleOpenEmail}
          />
        ))}
      </div>

      {/* Bottom Action Bar */}
      {bottomAction && (
        <button
          type="button"
          onClick={handleBottomAction}
          className="group flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left transition-all hover:border-border hover:bg-muted/40 dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/15 dark:hover:bg-zinc-900/70"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-foreground">
            <ListOrdered className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>{bottomAction.label}</span>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-all" />
        </button>
      )}

      {/* Email Modal preview */}
      <AgentEmailModal
        email={selectedEmail}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
