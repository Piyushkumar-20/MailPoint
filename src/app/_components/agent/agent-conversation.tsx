"use client";

import { useEffect, useRef } from "react";

import type { Message } from "@/app/_components/agent/types";
import { AgentEmptyState } from "@/app/_components/agent/agent-empty-state";
import { AgentLoading } from "@/app/_components/agent/agent-loading";
import { AgentMessage } from "@/app/_components/agent/agent-message";

export function AgentConversation({
  messages,
  isLoading,
  onSuggestion,
}: {
  messages: Message[];
  isLoading: boolean;
  onSuggestion: (prompt: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentEmptyState onSuggestion={onSuggestion} disabled={isLoading} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((message) => (
          <AgentMessage key={message.id} message={message} />
        ))}

        {isLoading && <AgentLoading />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
