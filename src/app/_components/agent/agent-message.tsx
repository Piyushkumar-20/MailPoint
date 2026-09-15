import { Bot, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Message } from "@/app/_components/agent/types";
import type { AgentConfirmation } from "@/lib/agent-types";
import { AgentMarkdown } from "@/app/_components/agent/agent-markdown";
import { AgentConfirmationCard } from "@/app/_components/agent/agent-confirmation-card";

export function AgentMessage({
  message,
  onConfirmationUpdate,
}: {
  message: Message;
  onConfirmationUpdate?: (
    messageId: string,
    updated: AgentConfirmation,
    outcomeMessage?: string,
  ) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end px-1">
        <div className="max-w-[min(42rem,88%)] rounded-2xl rounded-br-md border border-primary/20 bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-[0_8px_28px_-16px_hsl(var(--primary))]">
          <p className="whitespace-pre-line">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-1">
      <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.09] text-primary shadow-sm">
        <Bot className="size-[17px]" />
      </div>

      <div className={cn("min-w-0 flex-1 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm backdrop-blur-sm sm:p-5")}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-xs font-semibold text-foreground">MailPoint AI</span>
          </div>
          <span className="rounded-full border border-border/70 bg-muted/35 px-2 py-1 text-[10px] font-medium text-muted-foreground">AI response</span>
        </div>

        {message.content && <AgentMarkdown content={message.content} />}

        {message.confirmation && (
          <div className="mt-4">
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
  );
}
