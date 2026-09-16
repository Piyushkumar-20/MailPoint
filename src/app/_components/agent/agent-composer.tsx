"use client";

import { useEffect, useRef } from "react";
import { Paperclip, Send } from "lucide-react";

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
      className="mx-auto w-full max-w-3xl px-3 pb-3 sm:pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor="agent-composer" className="sr-only">
        Ask MailPoint anything
      </label>

      <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-card/90 px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 dark:border-white/10 dark:bg-[#11161d]/90 backdrop-blur-md">
        {/* Attachment Icon Button */}
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground select-none"
          aria-label="Attach file"
          title="Attach file (coming soon)"
        >
          <Paperclip className="size-4" />
        </button>

        {/* Subtle vertical separator */}
        <div className="h-4 w-px bg-border/60 shrink-0" aria-hidden="true" />

        {/* Input Textarea */}
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
            "text-foreground max-h-36 min-h-6 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm leading-5 outline-none",
            "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />

        {/* "Press Enter to send" Hint */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 shrink-0 select-none mr-0.5">
          Press
          <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Enter
          </kbd>
          to send
        </span>

        {/* Circular Send Button */}
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Send message"
          className="size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-all shrink-0 shadow-xs"
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </form>
  );
}
