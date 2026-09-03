import { Bot } from "lucide-react";

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
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[min(42rem,88%)] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm">
          <p className="whitespace-pre-line">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Bot className="size-4" />
      </div>

      <div
        className={cn(
          "bg-card text-card-foreground max-w-[min(46rem,88%)] min-w-0 rounded-lg border px-3 py-2.5 shadow-sm",
        )}
      >
        <div className="text-muted-foreground mb-1 text-xs font-medium">
          MailPoint AI
        </div>

        {message.content && <AgentMarkdown content={message.content} />}

        {message.confirmation && (
          <AgentConfirmationCard
            confirmation={message.confirmation}
            onStatusChange={(updated, outcomeMessage) =>
              onConfirmationUpdate?.(message.id, updated, outcomeMessage)
            }
          />
        )}
      </div>
    </div>
  );
}

