"use client";

import { useCallback, useState } from "react";

import { postAgentRequest } from "@/lib/agent-client";
import type { Message } from "@/app/_components/agent/types";

import { AgentComposer } from "@/app/_components/agent/agent-composer";
import { AgentConversation } from "@/app/_components/agent/agent-conversation";
import { AgentHeader } from "@/app/_components/agent/agent-header";

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AgentPanel({
  footerMinHeight,
}: {
  footerMinHeight?: number | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (rawInput: string) => {
      const input = rawInput.trim();

      if (!input || isLoading) {
        return;
      }

      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        content: input,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        userMessage,
      ]);
      setComposerValue("");
      setIsLoading(true);

      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await postAgentRequest(input, timezone);

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: createMessageId(),
            role: "assistant",
            content: response.output,
          },
        ]);
      } catch (error) {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: createMessageId(),
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "MailPoint couldn't process that request. Please try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const handleNewConversation = () => {
    if (messages.length === 0 || isLoading) {
      return;
    }

    const shouldClear = window.confirm(
      "Start a new conversation? This only clears the current AI chat.",
    );

    if (shouldClear) {
      setMessages([]);
      setComposerValue("");
    }
  };

  return (
    <section className="bg-muted/20 flex h-full min-h-0 flex-col">
      <AgentHeader
        hasMessages={messages.length > 0}
        isLoading={isLoading}
        onNewConversation={handleNewConversation}
      />

      <AgentConversation
        messages={messages}
        isLoading={isLoading}
        onSuggestion={sendMessage}
      />

      <div
        className="bg-background/95 border-t pt-3"
        style={
          footerMinHeight
            ? { minBlockSize: footerMinHeight }
            : undefined
        }
      >
        <AgentComposer
          value={composerValue}
          onChange={setComposerValue}
          onSubmit={() => {
            void sendMessage(composerValue);
          }}
          disabled={isLoading}
        />
      </div>
    </section>
  );
}