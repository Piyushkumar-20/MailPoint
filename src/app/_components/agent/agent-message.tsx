import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Message } from "@/app/_components/agent/types";
import { AgentMarkdown } from "@/app/_components/agent/agent-markdown";

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AgentMessage({ message }: { message: Message }) {
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
        <AgentMarkdown content={message.content} />

        {message.confirmation?.type === "calendar_event" && (
          <div className="bg-muted/40 mt-3 rounded-md border p-3 text-sm">
            <div className="font-medium">Calendar action requires confirmation</div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <div><span className="text-foreground">Title:</span> {message.confirmation.action.summary}</div>
              <div><span className="text-foreground">Start:</span> {formatDateTime(message.confirmation.action.start)}</div>
              <div><span className="text-foreground">End:</span> {formatDateTime(message.confirmation.action.end)}</div>
              {message.confirmation.action.attendees.length > 0 && (
                <div><span className="text-foreground">Attendees:</span> {message.confirmation.action.attendees.join(", ")}</div>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">No calendar changes have been made yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
