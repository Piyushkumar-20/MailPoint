"use client";

import { useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";

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
      className="mx-auto w-full max-w-3xl px-3 pb-3 md:px-6 md:pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor="agent-composer" className="sr-only">
        Ask MailPoint anything
      </label>
      <div className="bg-card focus-within:border-ring focus-within:ring-ring/30 rounded-lg border p-2 shadow-sm transition-colors focus-within:ring-3">
        <div className="flex items-end gap-2">
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
              "text-foreground max-h-42 min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-5 outline-none",
              "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />

          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send message"
            className="mb-0.5"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
