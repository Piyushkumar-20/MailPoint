import type { ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

type TextPart = { type: "text"; value: string };
type BoldPart = { type: "bold"; value: string };
type ItalicPart = { type: "italic"; value: string };
type StrikePart = { type: "strike"; value: string };
type CodePart = { type: "code"; value: string };
type LinkPart = { type: "link"; label: string; href: string };
type InlinePart =
  | TextPart
  | BoldPart
  | ItalicPart
  | StrikePart
  | CodePart
  | LinkPart;

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; code: string; language?: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "hr" }
  | { type: "table"; headers: string[]; rows: string[][] };

const inlinePattern =
  /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    if ((raw.startsWith("**") && raw.endsWith("**")) || (raw.startsWith("__") && raw.endsWith("__"))) {
      parts.push({ type: "bold", value: raw.slice(2, -2) });
    } else if (raw.startsWith("~~") && raw.endsWith("~~")) {
      parts.push({ type: "strike", value: raw.slice(2, -2) });
    } else if (raw.startsWith("*") && raw.endsWith("*") || raw.startsWith("_") && raw.endsWith("_")) {
      parts.push({ type: "italic", value: raw.slice(1, -1) });
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      parts.push({ type: "code", value: raw.slice(1, -1) });
    } else {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(raw);
      if (linkMatch?.[1] && linkMatch[2]) {
        parts.push({ type: "link", label: linkMatch[1], href: linkMatch[2] });
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
    if (part.type === "bold") return <strong key={index} className="font-semibold text-foreground">{part.value}</strong>;
    if (part.type === "italic") return <em key={index}>{part.value}</em>;
    if (part.type === "strike") return <del key={index} className="opacity-70">{part.value}</del>;
    if (part.type === "code") {
      return (
        <code key={index} className="rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 font-mono text-[0.82em] text-foreground">
          {part.value}
        </code>
      );
    }
    if (part.type === "link") {
      return (
        <a key={index} href={part.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
          {part.label}
          <ExternalLink className="size-3" />
        </a>
      );
    }
    return part.value;
  });
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const marker = trimmed.startsWith("```") ? "```" : "~~~";
      const language = trimmed.slice(marker.length).trim() || undefined;
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? "").trim().startsWith(marker)) {
        code.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push({ type: "code", code: code.join("\n"), language });
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && trimmed.includes("|") && isTableSeparator(lines[index + 1] ?? "")) {
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length) {
        const tableLine = lines[index]?.trim() ?? "";
        if (!tableLine?.includes("|")) break;
        const cells = splitTableRow(tableLine);
        if (cells.length !== headers.length) break;
        rows.push(cells);
        index += 1;
      }

      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading?.[1] && heading[2]) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith(">")) {
        quote.push((lines[index] ?? "").trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quote.join("\n") });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      const currentTrimmed = current.trim();
      if (!currentTrimmed) break;
      if (currentTrimmed.startsWith("```") || currentTrimmed.startsWith("~~~")) break;
      if (/^(#{1,3})\s+/.test(currentTrimmed)) break;
      if (/^\s*[-*+]\s+/.test(current)) break;
      if (/^\s*\d+[.)]\s+/.test(current)) break;
      if (/^\s*>/.test(current)) break;
      if (/^([-*_])(?:\s*\1){2,}$/.test(currentTrimmed)) break;
      if (index + 1 < lines.length && currentTrimmed.includes("|") && isTableSeparator(lines[index + 1] ?? "")) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

function AgentTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/45 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/35 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <span>{rows.length} {rows.length === 1 ? "result" : "results"}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">MailPoint AI</span>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[680px]">
          <div className="grid border-b border-border/60 bg-muted/20 px-3 py-2.5" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>
            {headers.map((header, index) => (
              <div key={`${header}-${index}`} className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {renderInline(header)}
              </div>
            ))}
          </div>

          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="group grid border-b border-border/50 px-3 py-3.5 last:border-b-0 transition-colors hover:bg-muted/25" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>
              {row.map((cell, cellIndex) => (
                <div key={`${rowIndex}-${cellIndex}`} className={cn("min-w-0 px-3 text-sm leading-5", cellIndex === 0 && "font-medium text-muted-foreground", cellIndex === 1 && "font-semibold text-foreground")}>
                  <span className={cn("block break-words", cellIndex === 0 && "inline-flex min-w-7 items-center justify-center rounded-lg bg-muted px-2 py-1 text-xs", cellIndex > 1 && "text-muted-foreground")}>{renderInline(cell)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border/60 md:hidden">
        {rows.map((row, rowIndex) => (
          <article key={rowIndex} className="p-3.5 transition-colors hover:bg-muted/20">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                {rowIndex + 1}
              </span>
              <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {renderInline(row[1] ?? row[0] ?? `Result ${rowIndex + 1}`)}
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
            <div className="grid gap-2 pl-9">
              {row.map((cell, cellIndex) => {
                if (cellIndex <= 1) return null;
                return (
                  <div key={`${rowIndex}-${cellIndex}`} className="rounded-xl bg-muted/35 px-3 py-2">
                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{headers[cellIndex]}</div>
                    <div className="text-xs leading-5 text-foreground/85">{renderInline(cell)}</div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" /> Results loaded</span>
        <span>Scroll for more</span>
      </div>
    </div>
  );
}

export function AgentMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className={cn("space-y-4 text-[13px] leading-6 text-foreground/90", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
          return <Heading key={index} className={cn("font-heading font-semibold tracking-tight text-foreground", block.level === 1 && "text-lg", block.level === 2 && "text-base", block.level === 3 && "text-sm")}>{renderInline(block.text)}</Heading>;
        }

        if (block.type === "code") {
          return (
            <div key={index} className="overflow-hidden rounded-2xl border border-border/70 bg-[#0b1014] shadow-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">
                <span className="inline-flex items-center gap-1.5"><Code2 className="size-3.5" />{block.language ?? "Code"}</span>
                <span className="size-2 rounded-full bg-emerald-400/80" />
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-5 text-white/85"><code>{block.code}</code></pre>
            </div>
          );
        }

        if (block.type === "table") return <AgentTable key={index} headers={block.headers} rows={block.rows} />;

        if (block.type === "ul") {
          return <ul key={index} className="space-y-2 pl-1">{block.items.map((item, itemIndex) => <li key={itemIndex} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /> <span>{renderInline(item)}</span></li>)}</ul>;
        }

        if (block.type === "ol") {
          return <ol key={index} className="space-y-2 pl-1">{block.items.map((item, itemIndex) => <li key={itemIndex} className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">{itemIndex + 1}</span><span className="pt-px">{renderInline(item)}</span></li>)}</ol>;
        }

        if (block.type === "blockquote") {
          return <blockquote key={index} className="rounded-r-xl border-l-2 border-primary/60 bg-primary/[0.06] px-4 py-2.5 text-sm italic text-muted-foreground">{renderInline(block.text)}</blockquote>;
        }

        if (block.type === "hr") return <div key={index} className="h-px bg-border/70" />;

        return <p key={index} className="whitespace-pre-line">{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
