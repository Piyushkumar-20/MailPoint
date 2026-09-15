import type {
  AgentStructuredData,
  AvailabilityData,
  CalendarEventItem,
  EmailItem,
} from "@/lib/agent-types";

export type DetectedResponseType =
  | "email-list"
  | "calendar-list"
  | "availability"
  | "empty"
  | "error"
  | "table"
  | "text";

export type ParsedAgentResponse = {
  type: DetectedResponseType;
  title?: string;
  subtitle?: string;
  countBadge?: string;
  count?: number;
  emails?: EmailItem[];
  events?: CalendarEventItem[];
  availability?: AvailabilityData;
  emptyMessage?: string;
  errorMessage?: string;
  bottomAction?: {
    label: string;
    actionType: "view-inbox" | "open-calendar" | "custom";
    href?: string;
  };
  followUpText?: string;
  markdownContent?: string;
};

/** Formats a date string into { date: "Mon, 14 Sep 2026", time: "9:05 PM" } */
export function formatEmailDateTime(rawDateStr: string): {
  date: string;
  time: string;
} {
  if (!rawDateStr?.trim()) {
    return { date: "", time: "" };
  }

  const trimmed = rawDateStr.trim();
  const parsedDate = new Date(trimmed);

  if (!Number.isNaN(parsedDate.getTime())) {
    try {
      const datePart = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsedDate);

      const timePart = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(parsedDate);

      return { date: datePart, time: timePart };
    } catch {
      // Fallback
    }
  }

  // If Date constructor failed, try regex extraction
  const timeMatch = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?)/i.exec(trimmed);
  const time = timeMatch ? timeMatch[1]?.trim() ?? "" : "";
  const date = time ? trimmed.replace(time, "").replace(/,\s*$/, "").trim() : trimmed;

  return { date: date || trimmed, time };
}

/** Extracts domain/brand name and category tags for an email */
export function inferEmailTags(
  senderName: string,
  senderEmail: string,
  subject: string,
  snippet: string,
): string[] {
  const tags: string[] = [];
  const text = `${senderName} ${subject} ${snippet}`.toLowerCase();
  const domain = senderEmail.split("@")[1]?.toLowerCase() ?? "";

  // 1. Category heuristics
  if (text.includes("newsletter") || text.includes("digest") || text.includes("weekly")) {
    tags.push("Newsletter");
  } else if (text.includes("webinar") || text.includes("event") || text.includes("hackathon") || text.includes("summit")) {
    tags.push("Event");
  } else if (text.includes("product update") || text.includes("release notes") || text.includes("announcing") || text.includes("what's new")) {
    tags.push("Product Update");
  } else if (text.includes("report") || text.includes("uptime") || text.includes("analytics") || text.includes("summary")) {
    tags.push("Report");
  } else if (text.includes("form") || text.includes("survey") || text.includes("receipts") || text.includes("response")) {
    tags.push("Form");
  } else if (text.includes("invoice") || text.includes("receipt") || text.includes("payment") || text.includes("billing")) {
    tags.push("Billing");
  } else if (text.includes("security") || text.includes("verification") || text.includes("otp") || text.includes("login")) {
    tags.push("Security");
  }

  // 2. Brand tag heuristic
  if (domain.includes("mongodb")) {
    tags.push("MongoDB");
  } else if (domain.includes("openai")) {
    tags.push("ChatGPT");
  } else if (domain.includes("devfolio")) {
    tags.push("Devfolio");
  } else if (domain.includes("hetrixtools")) {
    tags.push("HetrixTools");
  } else if (domain.includes("google")) {
    if (senderName.toLowerCase().includes("form")) {
      tags.push("Google Forms");
    } else {
      tags.push("Google");
    }
  } else if (domain.includes("github")) {
    tags.push("GitHub");
  } else if (domain.includes("stripe")) {
    tags.push("Stripe");
  } else if (domain.includes("vercel")) {
    tags.push("Vercel");
  } else if (senderName && !tags.some((t) => t.toLowerCase() === senderName.toLowerCase())) {
    // If we only have 1 tag or fewer, add cleaned sender name
    const cleanSender = senderName.split(/[@<]/)[0]?.trim();
    if (cleanSender && cleanSender.length <= 16 && !cleanSender.includes("noreply")) {
      tags.push(cleanSender);
    }
  }

  // Deduplicate and cap at 2 tags (matching reference design)
  return Array.from(new Set(tags)).slice(0, 2);
}

/** Parses "Name <email@example.com>" into { name, email } */
export function parseSender(fromStr: string): { name: string; email: string } {
  if (!fromStr) return { name: "Unknown", email: "" };
  const trimmed = fromStr.trim();
  const match = /(.*?)(?:<([^>]+)>|$)/.exec(trimmed);
  if (match) {
    const rawEmail = match[2]?.trim() ?? (trimmed.includes("@") ? trimmed : "");
    const rawName = match[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    const name = rawName ? rawName : (rawEmail.split("@")[0] ?? "Unknown");
    return { name, email: rawEmail };
  }
  return { name: trimmed, email: trimmed.includes("@") ? trimmed : "" };
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * Parses markdown to extract any markdown table and surrounding text blocks
 */
function extractMarkdownTable(markdown: string): {
  beforeText: string;
  headers: string[];
  rows: string[][];
  afterText: string;
} | null {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let tableStartIndex = -1;
  let tableSeparatorIndex = -1;

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]?.trim() ?? "";
    const nextLine = lines[i + 1]?.trim() ?? "";
    if (line.includes("|") && isTableSeparator(nextLine)) {
      tableStartIndex = i;
      tableSeparatorIndex = i + 1;
      break;
    }
  }

  if (tableStartIndex === -1) return null;

  const headers = splitTableRow(lines[tableStartIndex] ?? "");
  const rows: string[][] = [];
  let tableEndIndex = tableSeparatorIndex + 1;

  while (tableEndIndex < lines.length) {
    const line = lines[tableEndIndex]?.trim() ?? "";
    if (!line.includes("|")) break;
    const cells = splitTableRow(line);
    if (cells.length === headers.length) {
      rows.push(cells);
    }
    tableEndIndex++;
  }

  const beforeText = lines.slice(0, tableStartIndex).join("\n").trim();
  const afterText = lines.slice(tableEndIndex).join("\n").trim();

  return { beforeText, headers, rows, afterText };
}

/**
 * Primary detector function.
 * Determines how to render an agent message based on structuredData or parsed markdown.
 */
export function detectAgentResponse(
  content: string,
  structuredData?: AgentStructuredData,
): ParsedAgentResponse {
  // 1. If explicit structuredData is present from the server agent
  if (structuredData) {
    if (structuredData.type === "email-list" || structuredData.type === "search-results") {
      const emails: EmailItem[] = structuredData.items.map((item) => {
        const sender = parseSender(item.from ?? `${item.fromName ?? ""} <${item.fromEmail ?? ""}>`);
        const { date, time } = formatEmailDateTime(item.rawDate ?? item.date ?? "");
        const tags = item.tags && item.tags.length > 0
          ? item.tags
          : inferEmailTags(sender.name, sender.email, item.subject ?? "", item.snippet ?? "");

        return {
          ...item,
          fromName: item.fromName ?? sender.name,
          fromEmail: item.fromEmail ?? sender.email,
          date: item.date ?? date,
          time: item.time ?? time,
          tags,
        };
      });

      // Extract title and follow-up from content if present
      const tableInfo = extractMarkdownTable(content);
      const beforeLines = (tableInfo ? tableInfo.beforeText : content).split("\n").map((s) => s.trim()).filter(Boolean);
      const title = structuredData.title ?? beforeLines[0] ?? `Here are your ${emails.length} emails`;
      const subtitle = structuredData.subtitle ?? (beforeLines.length > 1 ? beforeLines[1] : "Your latest messages from Gmail, sorted by newest first.");
      const followUpText = tableInfo?.afterText ?? (beforeLines.length > 2 ? beforeLines.slice(2).join(" ") : undefined);

      return {
        type: "email-list",
        title,
        subtitle,
        countBadge: `${emails.length} emails`,
        count: emails.length,
        emails,
        bottomAction: {
          label: "View all emails in Gmail",
          actionType: "view-inbox",
        },
        followUpText: followUpText ?? "Let me know if you'd like to open an email, search for something, or take any action.",
      };
    }

    if (structuredData.type === "calendar-list") {
      const events: CalendarEventItem[] = structuredData.items;
      return {
        type: "calendar-list",
        title: structuredData.title ?? `Here are your ${events.length} upcoming events`,
        subtitle: structuredData.subtitle ?? "Events scheduled on your Google Calendar",
        countBadge: `${events.length} events`,
        count: events.length,
        events,
        bottomAction: {
          label: "Open Google Calendar",
          actionType: "open-calendar",
        },
        followUpText: "Let me know if you would like to reschedule or prepare for any of these events.",
      };
    }

    if (structuredData.type === "availability") {
      return {
        type: "availability",
        title: structuredData.title ?? "Calendar Availability",
        availability: structuredData.data,
        followUpText: structuredData.data.isAvailable
          ? "Would you like me to schedule a meeting for this time?"
          : "Would you like to schedule one of the alternative times above?",
      };
    }

    if (structuredData.type === "empty") {
      return {
        type: "empty",
        title: structuredData.title ?? "No results found",
        emptyMessage: structuredData.message ?? "No matching items found in your Gmail or Calendar.",
        followUpText: "Try refining your query or date range.",
      };
    }

    if (structuredData.type === "error") {
      return {
        type: "error",
        title: structuredData.title ?? "Unable to complete request",
        errorMessage: structuredData.message,
      };
    }
  }

  // 2. Parse markdown content for tables (handles existing localStorage history or direct LLM markdown)
  const tableData = extractMarkdownTable(content);
  if (tableData) {
    const { beforeText, headers, rows, afterText } = tableData;
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    const isEmailTable =
      lowerHeaders.some((h) => h.includes("from") || h.includes("sender")) &&
      lowerHeaders.some((h) => h.includes("subject") || h.includes("snippet") || h.includes("message"));

    const isCalendarTable =
      (lowerHeaders.some((h) => h.includes("event") || h.includes("summary") || h.includes("title")) &&
        lowerHeaders.some((h) => h.includes("time") || h.includes("date") || h.includes("start"))) ||
      lowerHeaders.some((h) => h.includes("calendar"));

    if (isEmailTable) {
      const fromIdx = lowerHeaders.findIndex((h) => h.includes("from") || h.includes("sender"));
      const subjectIdx = lowerHeaders.findIndex((h) => h.includes("subject"));
      const dateIdx = lowerHeaders.findIndex((h) => h.includes("date") || h.includes("time"));
      const snippetIdx = lowerHeaders.findIndex((h) => h.includes("snippet") || h.includes("preview") || h.includes("summary"));
      const idIdx = lowerHeaders.findIndex((h) => h.includes("id"));

      const emails: EmailItem[] = rows.map((row, index) => {
        const rawFrom = fromIdx !== -1 ? row[fromIdx] ?? "" : "";
        const rawSubject = subjectIdx !== -1 ? row[subjectIdx] ?? "" : "(No Subject)";
        const rawDate = dateIdx !== -1 ? row[dateIdx] ?? "" : "";
        const rawSnippet = snippetIdx !== -1 ? row[snippetIdx] ?? "" : "";
        const rawId = idIdx !== -1 ? row[idIdx] ?? `email-${index}` : `email-${index}`;

        const { name, email } = parseSender(rawFrom);
        const { date, time } = formatEmailDateTime(rawDate);
        const tags = inferEmailTags(name, email, rawSubject, rawSnippet);

        return {
          id: rawId,
          from: rawFrom,
          fromName: name,
          fromEmail: email,
          subject: rawSubject,
          snippet: rawSnippet,
          date,
          time,
          rawDate,
          tags,
        };
      });

      const beforeLines = beforeText.split("\n").map((s) => s.trim()).filter(Boolean);
      const title = beforeLines[0]
        ? beforeLines[0].replace(/^#+\s*/, "").replace(/[:.]+$/, "")
        : `Here are your ${emails.length} most recent emails`;
      const subtitle = beforeLines.length > 1
        ? beforeLines[1]
        : "Your latest messages from Gmail, sorted by newest first.";

      return {
        type: "email-list",
        title,
        subtitle,
        countBadge: `${emails.length} emails`,
        count: emails.length,
        emails,
        bottomAction: {
          label: "View all emails in Gmail",
          actionType: "view-inbox",
        },
        followUpText: afterText ? afterText : "Let me know if you'd like to open an email, search for something, or take any action.",
      };
    }

    if (isCalendarTable) {
      const summaryIdx = lowerHeaders.findIndex((h) => h.includes("event") || h.includes("summary") || h.includes("title"));
      const startIdx = lowerHeaders.findIndex((h) => h.includes("time") || h.includes("start") || h.includes("date"));
      const endIdx = lowerHeaders.findIndex((h) => h.includes("end"));
      const attendeesIdx = lowerHeaders.findIndex((h) => h.includes("attendee"));
      const locationIdx = lowerHeaders.findIndex((h) => h.includes("location"));

      const events: CalendarEventItem[] = rows.map((row, index) => {
        const summary = summaryIdx !== -1 ? (row[summaryIdx] ?? "Untitled Event") : "Untitled Event";
        const start = startIdx !== -1 ? (row[startIdx] ?? "") : "";
        const end = endIdx !== -1 ? (row[endIdx] ?? "") : undefined;
        const attendeesStr = attendeesIdx !== -1 ? (row[attendeesIdx] ?? "") : "";
        const location = locationIdx !== -1 ? (row[locationIdx] ?? undefined) : undefined;

        const attendees = attendeesStr
          ? attendeesStr.split(",").map((a) => ({ email: a.trim(), displayName: a.trim() }))
          : undefined;

        return {
          id: `cal-${index}`,
          summary,
          start,
          end,
          attendees,
          location,
        };
      });

      const beforeLines = beforeText.split("\n").map((s) => s.trim()).filter(Boolean);
      const title = beforeLines[0]
        ? beforeLines[0].replace(/^#+\s*/, "").replace(/[:.]+$/, "")
        : `Here are your ${events.length} scheduled events`;
      const subtitle = beforeLines.length > 1
        ? beforeLines[1]
        : "Events scheduled on your Google Calendar";

      return {
        type: "calendar-list",
        title,
        subtitle,
        countBadge: `${events.length} events`,
        count: events.length,
        events,
        bottomAction: {
          label: "Open Google Calendar",
          actionType: "open-calendar",
        },
        followUpText: afterText ? afterText : "Let me know if you would like to reschedule or make any changes.",
      };
    }

    // Generic table fallback
    return {
      type: "table",
      markdownContent: content,
    };
  }

  // 3. Detect empty states in content
  const lowerContent = content.toLowerCase();
  const isEmptyPattern =
    (lowerContent.includes("no emails found") ||
      lowerContent.includes("no messages found") ||
      lowerContent.includes("no matching emails") ||
      lowerContent.includes("no events found") ||
      lowerContent.includes("no calendar events found") ||
      lowerContent.includes("couldn't find any emails") ||
      lowerContent.includes("no upcoming meetings")) &&
    content.length < 300;

  if (isEmptyPattern) {
    return {
      type: "empty",
      title: "No results found",
      emptyMessage: content,
      followUpText: "Try searching with different keywords, check the date range, or ask something else.",
    };
  }

  // 4. Detect error states in content
  const isErrorPattern =
    (lowerContent.startsWith("error:") ||
      lowerContent.startsWith("error executing") ||
      lowerContent.includes("service temporarily unavailable") ||
      lowerContent.includes("failed to fetch") ||
      lowerContent.includes("failed to process agent request")) &&
    content.length < 350;

  if (isErrorPattern) {
    return {
      type: "error",
      title: "Unable to access service",
      errorMessage: content,
    };
  }

  // 5. Default conversational text
  return {
    type: "text",
    markdownContent: content,
  };
}
