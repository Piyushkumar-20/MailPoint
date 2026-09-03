"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { postAgentRequest, postConfirmation } from "@/lib/agent-client";
import type { Message } from "@/app/_components/agent/types";
import type { AgentConfirmation } from "@/lib/agent-types";

import { AgentComposer } from "@/app/_components/agent/agent-composer";
import { AgentConversation } from "@/app/_components/agent/agent-conversation";
import { AgentHeader } from "@/app/_components/agent/agent-header";

/** Patterns that mean the user is trying to confirm a pending proposal via the composer */
const CONFIRM_PATTERNS = [
  /^confirm\s*this$/i,
  /^confirm$/i,
  /^yes[,.]?\s*confirm(\s*it)?$/i,
  /^yes$/i,
  /^ok[,.]?\s*confirm$/i,
  /^schedule\s*it$/i,
];

function isConfirmKeyword(input: string): boolean {
  const trimmed = input.trim();
  return CONFIRM_PATTERNS.some((re) => re.test(trimmed));
}

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** localStorage key and version — bump version to discard old shapes */
const STORAGE_KEY = "mailpoint:agent:conversation:v1";
const MAX_STORED_MESSAGES = 30;

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as Message).id === "string" &&
        (typeof (m as Message).role === "string") &&
        typeof (m as Message).content === "string",
    );
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(msgs.slice(-MAX_STORED_MESSAGES)),
    );
  } catch {
    // localStorage quota exceeded or unavailable — silently ignore
  }
}

export function AgentPanel({
  footerMinHeight,
}: {
  footerMinHeight?: number | null;
}) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [composerValue, setComposerValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Persist messages to localStorage whenever they change
  const prevMessagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    if (prevMessagesRef.current !== messages) {
      prevMessagesRef.current = messages;
      saveMessages(messages);
    }
  }, [messages]);

  const handleConfirmationUpdate = useCallback(
    (
      messageId: string,
      updatedConfirmation: AgentConfirmation,
      outcomeMessage?: string,
    ) => {
      setMessages((currentMessages) => {
        const updated = currentMessages.map((msg) =>
          msg.id === messageId
            ? { ...msg, confirmation: updatedConfirmation }
            : msg,
        );

        if (outcomeMessage) {
          return [
            ...updated,
            {
              id: createMessageId(),
              role: "assistant" as const,
              content: outcomeMessage,
            },
          ];
        }

        return updated;
      });
    },
    [],
  );

  const sendMessage = useCallback(
    async (rawInput: string) => {
      const input = rawInput.trim();

      if (!input || isLoading) {
        return;
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // ── Intercept confirmation keywords ───────────────────────────────────
      // If the user types "Confirm this", "Confirm", "Yes", etc. while a
      // pending confirmation exists, execute the proposal directly via
      // /api/agent/confirm — never route this through the LLM.
      if (isConfirmKeyword(input)) {
        let pendingMessageId: string | undefined;
        let pendingToken: string | undefined;
        let pendingConfirmation: AgentConfirmation | undefined;

        // Find the most recent pending confirmation (iterate newest-first)
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg?.confirmation?.status === "pending") {
            pendingMessageId = msg.id;
            pendingToken = msg.confirmation.token;
            pendingConfirmation = msg.confirmation;
            break;
          }
        }

        if (pendingMessageId && pendingToken && pendingConfirmation) {
          setComposerValue("");
          setIsLoading(true);

          // Show the user's typed confirm message in the conversation
          setMessages((prev) => [
            ...prev,
            { id: createMessageId(), role: "user" as const, content: input },
          ]);

          try {
            const res = await postConfirmation(pendingToken, "confirm");

            if (res.success && res.status === "confirmed") {
              handleConfirmationUpdate(
                pendingMessageId,
                { ...pendingConfirmation, status: "confirmed" },
                res.message ?? "Meeting scheduled successfully.",
              );
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  id: createMessageId(),
                  role: "assistant" as const,
                  content:
                    res.message ??
                    "Failed to confirm the meeting. Please try again.",
                },
              ]);
            }
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: "assistant" as const,
                content:
                  err instanceof Error
                    ? err.message
                    : "Failed to confirm the meeting. Please try again.",
              },
            ]);
          } finally {
            setIsLoading(false);
          }

          return; // Never fall through to the LLM path
        }
      }

      // ── Normal LLM path ───────────────────────────────────────────────────
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
        // Build conversation history for multi-turn context (last 10 text turns only)
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await postAgentRequest(input, timezone, history);

        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: createMessageId(),
            role: "assistant",
            content: response.output,
            confirmation: response.confirmation,
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
    [isLoading, messages, handleConfirmationUpdate],
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
      // Clear persisted conversation from localStorage
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
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
        onConfirmationUpdate={handleConfirmationUpdate}
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