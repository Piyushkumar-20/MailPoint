"use client";

import { useEffect, useRef } from "react";
import { Paperclip, SendHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [value]);

  return (
    <form
      className="mx-auto w-full max-w-4xl px-3 pb-3 md:px-6 md:pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor="agent-composer" className="sr-only">
        Ask MailPoint anything
      </label>
      <div className="rounded-2xl border border-border/80 bg-card/90 dark:border-white/10 dark:bg-[#11161d]/90 p-2 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Attachment Icon Button */}
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground select-none"
            aria-label="Attach file"
            title="Attach file (coming soon)"
          >
            <Paperclip className="size-4" />
          </button>

          <textarea
            ref={textareaRef}
            id="agent-composer"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            disabled={disabled}
            rows={1}
            placeholder="Ask MailPoint anything..."
            className={cn(
              "text-foreground max-h-42 min-h-8 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1.5 text-sm leading-5 outline-none",
              "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />

          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send message"
            className="size-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
