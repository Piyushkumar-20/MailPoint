"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinkifiedText } from "@/lib/display";
import {
  buildEmailDocument,
  sanitizeEmailHtml,
} from "@/lib/sanitize-email";

export type EmailRendererProps = {
  body: string;
  bodyMimeType?: "text/plain" | "text/html";
  className?: string;
};

/**
 * Checks if a string looks like raw HTML (e.g. contains common HTML tags).
 */
function looksLikeHtml(text: string): boolean {
  return /<\/?(?:a|b|blockquote|br|center|div|font|h[1-6]|hr|i|img|li|ol|p|span|strong|style|table|tbody|td|th|tr|u|ul)\b/i.test(
    text,
  );
}

/**
 * Parses plain text email into regular paragraphs and blockquote sections (for quotes/replies).
 */
function PlainTextBody({ text }: { text: string }) {
  const lines = useMemo(() => text.split(/\r?\n/), [text]);

  // Group lines into quote blocks (starting with '>') and normal blocks
  const sections = useMemo(() => {
    const result: { isQuote: boolean; lines: string[] }[] = [];
    let currentIsQuote: boolean | null = null;
    let currentGroup: string[] = [];

    for (const line of lines) {
      const isQuote = line.trimStart().startsWith(">");
      if (currentIsQuote === null) {
        currentIsQuote = isQuote;
        currentGroup.push(isQuote ? line.replace(/^\s*>\s?/, "") : line);
      } else if (currentIsQuote === isQuote) {
        currentGroup.push(isQuote ? line.replace(/^\s*>\s?/, "") : line);
      } else {
        result.push({ isQuote: currentIsQuote, lines: currentGroup });
        currentIsQuote = isQuote;
        currentGroup = [isQuote ? line.replace(/^\s*>\s?/, "") : line];
      }
    }

    if (currentGroup.length > 0 && currentIsQuote !== null) {
      result.push({ isQuote: currentIsQuote, lines: currentGroup });
    }

    return result;
  }, [lines]);

  return (
    <div className="space-y-3 font-sans text-sm leading-relaxed text-foreground">
      {sections.map((sec, idx) => {
        const textContent = sec.lines.join("\n");
        if (sec.isQuote) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground whitespace-pre-wrap break-words italic"
            >
              <LinkifiedText text={textContent} />
            </blockquote>
          );
        }
        return (
          <div key={idx} className="whitespace-pre-wrap break-words">
            <LinkifiedText text={textContent} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Isolated Sandboxed HTML Email Renderer.
 *
 * Runs inside a sandboxed iframe without allow-scripts or allow-forms,
 * isolating email CSS from the MailPoint UI and preventing any XSS or styling bleed.
 * Dynamically adapts height to the exact email content without infinite expansion loops
 * or unnecessary second scrollbars. Wide email layouts scroll horizontally naturally.
 */
function HtmlEmailIframe({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(100);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const srcDoc = useMemo(() => buildEmailDocument(html), [html]);

  const updateHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    try {
      const doc = iframe.contentDocument;
      const body = doc.body;
      if (!body) return;

      // When html and body have height: auto in the iframe baseline,
      // body dimensions reflect the exact content height without viewport feedback loops.
      const rect = body.getBoundingClientRect();
      const contentH = Math.ceil(
        Math.max(rect.height, body.scrollHeight, body.offsetHeight),
      );

      if (contentH > 0) {
        setHeight((prev) => {
          // Avoid jitter and infinite loops if difference is negligible
          if (Math.abs(prev - contentH) <= 2) return prev;
          return Math.max(contentH, 60);
        });
      }
    } catch {
      // Cross-origin fallback in unexpected edge cases
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoaded(true);
    updateHeight();

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    try {
      const doc = iframe.contentDocument;
      const body = doc.body;
      if (!body) return;

      // Observe size changes via ResizeObserver on body only.
      // (Observing documentElement causes infinite height expansion loops).
      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
            if (h > 0) {
              const targetH = Math.ceil(h);
              setHeight((prev) => {
                if (Math.abs(prev - targetH) <= 2) return prev;
                return Math.max(targetH, 60);
              });
            }
          }
        });
        observer.observe(body);
      }

      // Listen to load and error events on images to recalculate height as images finish downloading
      const images = doc.querySelectorAll("img");
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", updateHeight, { once: true });
          img.addEventListener("error", updateHeight, { once: true });
        }
      });

      return () => {
        observer?.disconnect();
      };
    } catch {
      return undefined;
    }
  }, [updateHeight]);

  // Window resize handler
  useEffect(() => {
    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, [updateHeight]);

  return (
    <div
      className={`w-full overflow-x-auto rounded-md bg-white transition-opacity duration-200 ${
        isLoaded ? "opacity-100" : "opacity-90"
      } ${className ?? ""}`}
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title="Email content"
        tabIndex={0}
        className="w-full border-0 block"
        style={{
          height: `${height}px`,
          minHeight: "60px",
          width: "100%",
          minWidth: "100%",
          display: "block",
          border: "none",
        }}
        onLoad={handleIframeLoad}
      />
    </div>
  );
}

/**
 * Production-Grade Email Renderer.
 * Supports text/html (sanitized & sandboxed) and text/plain (with linkification and quotes).
 */
export function EmailRenderer({
  body,
  bodyMimeType = "text/html",
  className,
}: EmailRendererProps) {
  const isHtml = bodyMimeType === "text/html" || looksLikeHtml(body);

  const sanitizedHtml = useMemo(() => {
    if (!isHtml) return "";
    return sanitizeEmailHtml(body);
  }, [body, isHtml]);

  if (isHtml && sanitizedHtml) {
    return <HtmlEmailIframe html={sanitizedHtml} className={className} />;
  }

  return <PlainTextBody text={body} />;
}

export default EmailRenderer;
