import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TextPart = {
  type: "text";
  value: string;
};

type BoldPart = {
  type: "bold";
  value: string;
};

type CodePart = {
  type: "code";
  value: string;
};

type LinkPart = {
  type: "link";
  label: string;
  href: string;
};

type InlinePart = TextPart | BoldPart | CodePart | LinkPart;

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; code: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const inlinePattern =
  /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    if (raw.startsWith("**") && raw.endsWith("**")) {
      parts.push({ type: "bold", value: raw.slice(2, -2) });
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      parts.push({ type: "code", value: raw.slice(1, -1) });
    } else {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(raw);

      if (linkMatch?.[1] && linkMatch[2]) {
        parts.push({
          type: "link",
          label: linkMatch[1],
          href: linkMatch[2],
        });
      } else {
        parts.push({ type: "text", value: raw });
      }
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function renderInline(text: string): ReactNode {
  return parseInline(text).map((part, index) => {
    if (part.type === "bold") {
      return <strong key={index}>{part.value}</strong>;
    }

    if (part.type === "code") {
      return (
        <code
          key={index}
          className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.value}
        </code>
      );
    }

    if (part.type === "link") {
      return (
        <a
          key={index}
          href={part.href}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:text-primary/80 underline underline-offset-4"
        >
          {part.label}
        </a>
      );
    }

    return part.value;
  });
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      index += 1;

      while (
        index < lines.length &&
        !(lines[index] ?? "").trim().startsWith("```")
      ) {
        code.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push({ type: "code", code: code.join("\n") });
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);

    if (heading?.[1] && heading[2]) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraph: string[] = [];

    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !(lines[index] ?? "").trim().startsWith("```") &&
      !/^(#{1,3})\s+/.test(lines[index] ?? "") &&
      !/^\s*[-*]\s+/.test(lines[index] ?? "") &&
      !/^\s*\d+\.\s+/.test(lines[index] ?? "")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

export function AgentMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseMarkdown(content);

  return (
    <div className={cn("space-y-3 text-sm leading-6", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading =
            block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";

          return (
            <Heading
              key={index}
              className={cn(
                "font-heading text-foreground font-semibold",
                block.level === 1 && "text-base",
                block.level === 2 && "text-[0.95rem]",
                block.level === 3 && "text-sm",
              )}
            >
              {renderInline(block.text)}
            </Heading>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="bg-muted/60 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-5"
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index} className="whitespace-pre-line">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
