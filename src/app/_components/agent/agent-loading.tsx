import { Bot } from "lucide-react";

export function AgentLoading() {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Bot className="size-4" />
      </div>

      <div className="bg-card text-card-foreground min-w-0 rounded-lg border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">MailPoint AI</span>
          <span className="text-muted-foreground text-sm">Thinking</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="bg-muted-foreground/70 size-1.5 animate-pulse rounded-full" />
            <span className="bg-muted-foreground/70 size-1.5 animate-pulse rounded-full delay-150" />
            <span className="bg-muted-foreground/70 size-1.5 animate-pulse rounded-full delay-300" />
          </span>
        </div>
      </div>
    </div>
  );
}
