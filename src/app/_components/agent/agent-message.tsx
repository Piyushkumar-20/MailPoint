import { Bot, Check, ExternalLink, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Message } from "@/app/_components/agent/types";
import { AgentMarkdown } from "@/app/_components/agent/agent-markdown";
import { Button, buttonVariants } from "@/components/ui/button";

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AgentMessage({
  message,
  confirmationBusy = false,
  onConfirmCalendar,
  onCancelCalendar,
}: {
  message: Message;
  confirmationBusy?: boolean;
  onConfirmCalendar?: () => void;
  onCancelCalendar?: () => void;
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

  const confirmation = message.confirmation;

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

        {confirmation?.type === "calendar_event" && (
          <div className="bg-muted/40 mt-3 rounded-md border p-3 text-sm">
            <div className="font-medium">
              {confirmation.status === "confirmed"
                ? "Calendar event created"
                : confirmation.status === "cancelled"
                  ? "Calendar action cancelled"
                  : confirmation.status === "approval_required"
                    ? "Calendar approval required"
                    : "Calendar action requires confirmation"}
            </div>

            <div className="mt-2 space-y-1 text-muted-foreground">
              <div>
                <span className="text-foreground">Title:</span>{" "}
                {confirmation.action.summary}
              </div>
              <div>
                <span className="text-foreground">Start:</span>{" "}
                {formatDateTime(confirmation.action.start)}
              </div>
              <div>
                <span className="text-foreground">End:</span>{" "}
                {formatDateTime(confirmation.action.end)}
              </div>
              {confirmation.action.attendees.length > 0 && (
                <div>
                  <span className="text-foreground">Attendees:</span>{" "}
                  {confirmation.action.attendees.join(", ")}
                </div>
              )}
            </div>

            {confirmation.status === "confirmed" ? (
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {confirmation.result?.eventId && (
                  <div>
                    <span className="text-foreground">Event ID:</span>{" "}
                    {confirmation.result.eventId}
                  </div>
                )}

                {confirmation.result?.htmlLink && (
                  <a
                    href={confirmation.result.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "outline",
                        size: "sm",
                      }),
                    )}
                  >
                    <ExternalLink className="size-3.5" />
                    Open event
                  </a>
                )}
              </div>
            ) : confirmation.status === "cancelled" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No calendar changes were made.
              </p>
            ) : confirmation.status === "approval_required" ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  Approve this action in Corsair, then return here and retry.
                </p>

                {confirmation.approvalUrl && (
                  <a
                    href={confirmation.approvalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "outline",
                        size: "sm",
                      }),
                      "mt-3",
                    )}
                  >
                    <ExternalLink className="size-3.5" />
                    Open Corsair approval
                  </a>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmationBusy}
                    onClick={onConfirmCalendar}
                  >
                    <Check className="size-3.5" />
                    {confirmationBusy ? "Checking" : "I've approved — retry"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={confirmationBusy}
                    onClick={onCancelCalendar}
                  >
                    <X className="size-3.5" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {confirmation.status === "error" &&
                  confirmation.error && (
                    <p className="text-destructive mt-3 text-xs">
                      {confirmation.error}
                    </p>
                  )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmationBusy}
                    onClick={onConfirmCalendar}
                  >
                    <Check className="size-3.5" />
                    {confirmationBusy ? "Confirming" : "Confirm"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={confirmationBusy}
                    onClick={onCancelCalendar}
                  >
                    <X className="size-3.5" />
                    Cancel
                  </Button>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  No calendar changes have been made yet.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
