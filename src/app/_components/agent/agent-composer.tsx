"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Paperclip, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  length: number;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
};

type SpeechRecognitionErrorLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type AgentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onVoiceSubmit?: (transcript: string) => void;
  disabled: boolean;
};

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  onVoiceSubmit,
  disabled,
}: AgentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);

  const [isListening, setIsListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<"en-US" | "hi-IN">(
    "en-US",
  );
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const canSend = value.trim().length > 0 && !disabled;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = () => {
    if (isListening) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      setVoiceError(
        "Microphone access requires HTTPS or localhost. Open MailPoint securely and try again.",
      );
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceError(
        "Speech recognition is not supported in this browser. Try Chrome or Edge.",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();

      recognition.lang = voiceLanguage;
      recognition.continuous = false;
      recognition.interimResults = false;

      let hasSubmitted = false;

      shouldListenRef.current = true;
      recognitionRef.current = recognition;

      setVoiceError(null);
      setIsListening(true);

      recognition.onresult = (event) => {
        if (!shouldListenRef.current || hasSubmitted) return;

        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result) => result[0].transcript)
          .join(" ")
          .trim();

        if (!transcript) return;

        hasSubmitted = true;
        shouldListenRef.current = false;

        // Preserve any text already entered in the composer.
        const combinedText = `${value.trim()}${value.trim() ? " " : ""}${transcript}`;

        // Update the composer and submit the recognized command.
        onChange(combinedText);

        if (onVoiceSubmit) {
          onVoiceSubmit(combinedText);
        }
      };

      recognition.onerror = (event) => {
        shouldListenRef.current = false;

        if (event.error === "aborted") return;

        const messages: Record<string, string> = {
          "not-allowed":
            "Microphone permission was denied. Allow microphone access in your browser settings.",
          "no-speech":
            "No speech detected. Click the microphone and try again.",
          "audio-capture":
            "No microphone was found. Check your microphone connection.",
          network:
            "Speech recognition encountered a network error. Please try again.",
          "service-not-allowed":
            "The browser blocked speech recognition. Check your browser settings.",
        };

        setVoiceError(
          messages[event.error] ??
            `Voice input failed (${event.error}). Please try again.`,
        );
      };

      recognition.onend = () => {
        shouldListenRef.current = false;
        setIsListening(false);

        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
      };

      recognition.start();
    } catch {
      shouldListenRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError("Could not start the microphone. Please try again.");
    }
  };

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

      <div className="border-border/80 bg-card/90 focus-within:border-primary/40 focus-within:ring-primary/20 flex items-center gap-2.5 rounded-2xl border px-3 py-2 shadow-sm backdrop-blur-md transition-all focus-within:ring-2 sm:px-4 sm:py-2.5 dark:border-white/10 dark:bg-[#11161d]/90">
        <button
          type="button"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors select-none"
          aria-label="Attach file"
          title="Attach file (coming soon)"
          disabled={disabled}
        >
          <Paperclip className="size-4" />
        </button>

        <div className="bg-border/60 h-4 w-px shrink-0" aria-hidden="true" />

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

        <select
          aria-label="Voice input language"
          title="Choose voice input language"
          value={voiceLanguage}
          onChange={(event) =>
            setVoiceLanguage(event.target.value as "en-US" | "hi-IN")
          }
          disabled={isListening || disabled}
          className="bg-muted/60 text-muted-foreground h-8 max-w-[76px] shrink-0 rounded-md border-0 px-1 text-xs outline-none"
        >
          <option value="en-US">EN</option>
          <option value="hi-IN">HI</option>
        </select>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleVoiceInput}
          disabled={disabled}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          title={isListening ? "Stop listening" : "Speak to MailPoint"}
          className={cn(
            "size-8 shrink-0 rounded-full",
            isListening && "animate-pulse text-red-500",
          )}
        >
          {isListening ? (
            <MicOff className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>

        <span className="text-muted-foreground/70 mr-0.5 hidden shrink-0 items-center gap-1.5 text-xs select-none sm:inline-flex">
          Press
          <kbd className="border-border/80 bg-muted/60 text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-semibold">
            Enter
          </kbd>
          to send
        </span>

        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Send message"
          className="bg-primary text-primary-foreground hover:bg-primary/90 size-8 shrink-0 rounded-full shadow-xs transition-all disabled:opacity-30"
        >
          <Send className="size-3.5" />
        </Button>
      </div>

      {isListening && (
        <p className="text-muted-foreground mt-2 px-2 text-xs" role="status">
          Listening in {voiceLanguage === "en-US" ? "English" : "Hindi"}… Speak
          now, or click the microphone to stop.
        </p>
      )}

      {voiceError && (
        <p className="text-destructive mt-2 px-2 text-xs" role="alert">
          {voiceError}
        </p>
      )}
    </form>
  );
}
