"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

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
      className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6 sm:pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor="agent-composer" className="sr-only">
        Ask MailPoint anything
      </label>

      <div className="flex items-end gap-2 rounded-[1.35rem] border border-border bg-card px-4 py-3 transition-colors focus-within:border-brand/45 focus-within:ring-2 focus-within:ring-brand/10 sm:px-5 sm:py-3.5">

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
            "text-foreground max-h-36 min-h-7 flex-1 resize-none overflow-y-auto bg-transparent px-0 py-1 text-sm leading-6 outline-none",
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
          className="h-8 max-w-[68px] shrink-0 rounded-lg border border-border bg-muted/50 px-2 text-xs text-muted-foreground outline-none"
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
            "size-8 shrink-0 rounded-lg",
            isListening && "animate-pulse text-red-500",
          )}
        >
          {isListening ? (
            <MicOff className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>


        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Send message"
          className="btn-asym size-9 shrink-0 rounded-xl bg-brand text-white transition-colors hover:brightness-95 disabled:opacity-35"
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
