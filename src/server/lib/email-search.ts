import { GoogleGenAI } from "@google/genai";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { emailEmbeddings } from "@/server/db/schema";
import { getExistingClassifications, type PriorityLevel } from "./email-intelligence";

export interface ParsedSearchQuery {
  rawQuery: string;
  freeText: string;
  from?: string;
  to?: string;
  subject?: string;
  priority?: PriorityLevel;
  isUnread?: boolean;
  isStarred?: boolean;
  afterDate?: Date;
  beforeDate?: Date;
}

export interface SearchFilterOptions {
  mailbox?: "inbox" | "starred" | "sent" | "trash";
  priority?: "all" | PriorityLevel | "high";
  afterDate?: string;
  beforeDate?: string;
  limit?: number;
}

export type SearchMode = "hybrid" | "semantic" | "keyword";

export interface SearchResultItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string | null;
  timestamp: number;
  labelIds: string[];
  priority?: PriorityLevel;
  confidence?: number;
  priorityReason?: string;
  matchOrigin: "keyword" | "semantic" | "hybrid";
  relevanceScore: number;
  matchedFields: string[];
}

export interface UnifiedSearchResponse {
  items: SearchResultItem[];
  totalCount: number;
  modeUsed: SearchMode;
  stats: {
    keywordMatches: number;
    semanticMatches: number;
    hybridMatches: number;
  };
}

/**
 * Parses Gmail-style advanced query syntax:
 * from:user@example.com to:alice subject:report priority:urgent is:unread is:starred after:2026-01-01 before:2026-12-31
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = {
    rawQuery: query,
    freeText: "",
  };

  const tokens = query.trim().split(/\s+/);
  const remainingTokens: string[] = [];

  for (const token of tokens) {
    if (!token) continue;

    const lower = token.toLowerCase();

    if (lower.startsWith("from:")) {
      result.from = token.slice(5).trim();
    } else if (lower.startsWith("to:")) {
      result.to = token.slice(3).trim();
    } else if (lower.startsWith("subject:")) {
      result.subject = token.slice(8).trim();
    } else if (lower.startsWith("priority:")) {
      const p = token.slice(9).toLowerCase().trim();
      if (p === "urgent" || p === "important" || p === "normal" || p === "low") {
        result.priority = p;
      }
    } else if (lower === "is:unread") {
      result.isUnread = true;
    } else if (lower === "is:read") {
      result.isUnread = false;
    } else if (lower === "is:starred") {
      result.isStarred = true;
    } else if (lower.startsWith("after:")) {
      const dateStr = token.slice(6).trim();
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) result.afterDate = d;
    } else if (lower.startsWith("before:")) {
      const dateStr = token.slice(7).trim();
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) result.beforeDate = d;
    } else {
      remainingTokens.push(token);
    }
  }

  result.freeText = remainingTokens.join(" ").trim();
  return result;
}

/**
 * Initialize Gemini client for embeddings.
 */
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured for semantic embeddings.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Compute cosine similarity between two normalized or raw numerical vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates a 768-dimensional text embedding using models/gemini-embedding-001.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();
  const truncated = text.slice(0, 2048);

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: truncated,
    config: {
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Failed to generate embedding vector from Gemini.");
  }

  return values;
}

/**
 * Prepares the chunk content for an email to be embedded.
 */
export function buildEmailEmbedChunk(email: {
  subject?: string | null;
  from?: string | null;
  snippet?: string | null;
  body?: string | null;
}): string {
  const parts: string[] = [];
  if (email.subject) parts.push(`Subject: ${email.subject}`);
  if (email.from) parts.push(`From: ${email.from}`);
  const content = email.body ?? email.snippet;
  if (content) parts.push(`Content: ${content}`);
  return parts.join("\n");
}

/**
 * Retrieve or generate embeddings for a batch of emails for a tenant.
 */
export async function getOrGenerateEmbeddings(
  tenantId: string,
  emails: Array<{
    id: string;
    subject?: string | null;
    from?: string | null;
    snippet?: string | null;
    body?: string | null;
  }>,
): Promise<Map<string, number[]>> {
  const embeddingMap = new Map<string, number[]>();
  if (emails.length === 0) return embeddingMap;

  const messageIds = emails.map((e) => e.id);

  // 1. Fetch existing stored embeddings
  const existingRecords = await db
    .select()
    .from(emailEmbeddings)
    .where(
      and(
        eq(emailEmbeddings.tenantId, tenantId),
        inArray(emailEmbeddings.messageId, messageIds),
      ),
    );

  for (const record of existingRecords) {
    if (Array.isArray(record.embedding)) {
      embeddingMap.set(record.messageId, record.embedding as number[]);
    }
  }

  // 2. Filter out emails needing new embeddings
  const toEmbed = emails.filter((e) => !embeddingMap.has(e.id));
  if (toEmbed.length === 0) return embeddingMap;

  // Process sequentially or small batches to respect rate limits
  for (const item of toEmbed.slice(0, 20)) {
    try {
      const chunk = buildEmailEmbedChunk(item);
      const vector = await generateTextEmbedding(chunk);
      const now = new Date();
      const recordId = crypto.randomUUID();

      await db
        .insert(emailEmbeddings)
        .values({
          id: recordId,
          tenantId,
          messageId: item.id,
          embedding: vector,
          chunkContent: chunk,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [emailEmbeddings.tenantId, emailEmbeddings.messageId],
          set: {
            embedding: vector,
            chunkContent: chunk,
            updatedAt: now,
          },
        });

      embeddingMap.set(item.id, vector);
    } catch (err) {
      console.warn(`Failed to generate embedding for message ${item.id}:`, err);
    }
  }

  return embeddingMap;
}

/**
 * Keyword match scoring across sender, subject, and snippet.
 */
function calculateKeywordScore(
  email: {
    subject?: string | null;
    from?: string | null;
    snippet?: string | null;
  },
  queryTokens: string[],
): { score: number; matchedFields: string[] } {
  if (queryTokens.length === 0) {
    return { score: 1.0, matchedFields: [] };
  }

  const subject = (email.subject ?? "").toLowerCase();
  const from = (email.from ?? "").toLowerCase();
  const snippet = (email.snippet ?? "").toLowerCase();

  let totalMatchWeight = 0;
  const matchedFields = new Set<string>();

  for (const token of queryTokens) {
    const t = token.toLowerCase();
    let tokenMatched = false;

    if (subject.includes(t)) {
      totalMatchWeight += 3.0;
      matchedFields.add("subject");
      tokenMatched = true;
    }
    if (from.includes(t)) {
      totalMatchWeight += 2.0;
      matchedFields.add("from");
      tokenMatched = true;
    }
    if (snippet.includes(t)) {
      totalMatchWeight += 1.5;
      matchedFields.add("content");
      tokenMatched = true;
    }

    if (!tokenMatched) {
      // Partial credit for subwords if >= 4 chars
      if (t.length >= 4) {
        if (subject.includes(t.slice(0, 3))) totalMatchWeight += 0.5;
        if (snippet.includes(t.slice(0, 3))) totalMatchWeight += 0.25;
      }
    }
  }

  const maxPossible = queryTokens.length * 3.0;
  const normalized = maxPossible > 0 ? Math.min(1.0, totalMatchWeight / maxPossible) : 0;

  return {
    score: normalized,
    matchedFields: Array.from(matchedFields),
  };
}

export interface CandidateEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  body?: string;
  date: string | null;
  timestamp: number;
  labelIds: string[];
}

/**
 * Execute intelligent multi-mode search (keyword, semantic, hybrid).
 */
export async function executeIntelligentSearch({
  tenantId,
  candidates,
  query,
  mode = "hybrid",
  filter,
}: {
  tenantId: string,
  candidates: CandidateEmail[],
  query: string,
  mode?: SearchMode,
  filter?: SearchFilterOptions,
}): Promise<UnifiedSearchResponse> {
  const parsed = parseSearchQuery(query);
  const messageIds = candidates.map((c) => c.id);

  // 1. Fetch classifications to support priority filtering & display
  const classifications = await getExistingClassifications(tenantId, messageIds);

  // 2. Filter candidates based on structured operators
  const filtered = candidates.filter((item) => {
    // Label checks for mailbox
    if (filter?.mailbox === "starred" && !item.labelIds.includes("STARRED")) return false;
    if (filter?.mailbox === "trash" && !item.labelIds.includes("TRASH")) return false;
    if (filter?.mailbox === "inbox" && !item.labelIds.includes("INBOX")) return false;

    // Advanced parsed filters
    if (parsed.from && !item.from.toLowerCase().includes(parsed.from.toLowerCase())) {
      return false;
    }
    if (parsed.to && !item.to.toLowerCase().includes(parsed.to.toLowerCase())) {
      return false;
    }
    if (parsed.subject && !item.subject.toLowerCase().includes(parsed.subject.toLowerCase())) {
      return false;
    }
    if (parsed.isUnread === true && !item.labelIds.includes("UNREAD")) {
      return false;
    }
    if (parsed.isUnread === false && item.labelIds.includes("UNREAD")) {
      return false;
    }
    if (parsed.isStarred === true && !item.labelIds.includes("STARRED")) {
      return false;
    }
    if (parsed.afterDate && item.timestamp < parsed.afterDate.getTime()) {
      return false;
    }
    if (parsed.beforeDate && item.timestamp > parsed.beforeDate.getTime()) {
      return false;
    }

    // Priority filter (from query operator or explicit filter option)
    const effectivePriorityFilter = parsed.priority ?? (filter?.priority !== "all" ? filter?.priority : undefined);
    if (effectivePriorityFilter) {
      const cls = classifications.get(item.id);
      const emailPriority = cls?.priority ?? "normal";

      if (effectivePriorityFilter === "high") {
        if (emailPriority !== "urgent" && emailPriority !== "important") return false;
      } else {
        if (emailPriority !== effectivePriorityFilter) return false;
      }
    }

    return true;
  });

  const queryTerms = parsed.freeText.split(/\s+/).filter(Boolean);
  const isSearchEmpty = queryTerms.length === 0 && !parsed.from && !parsed.subject && !parsed.to;

  // If no search terms are present, return filtered list directly sorted by date
  if (isSearchEmpty) {
    const items: SearchResultItem[] = filtered.map((item) => {
      const cls = classifications.get(item.id);
      return {
        id: item.id,
        threadId: item.threadId,
        subject: item.subject,
        from: item.from,
        to: item.to,
        snippet: item.snippet,
        date: item.date,
        timestamp: item.timestamp,
        labelIds: item.labelIds,
        priority: cls?.priority,
        confidence: cls?.confidence,
        priorityReason: cls?.reason,
        matchOrigin: "keyword",
        relevanceScore: 1.0,
        matchedFields: [],
      };
    });

    return {
      items: items.slice(0, filter?.limit ?? 50),
      totalCount: items.length,
      modeUsed: mode,
      stats: { keywordMatches: items.length, semanticMatches: 0, hybridMatches: 0 },
    };
  }

  // 3. Keyword Scoring
  const keywordScores = new Map<string, { score: number; matchedFields: string[] }>();
  for (const item of filtered) {
    const res = calculateKeywordScore(item, queryTerms);
    keywordScores.set(item.id, res);
  }

  // 4. Semantic Scoring (if mode is hybrid or semantic)
  const semanticScores = new Map<string, number>();
  let actualModeUsed = mode;

  if (mode === "semantic" || mode === "hybrid") {
    try {
      // Generate embedding for query text
      const queryEmbedding = await generateTextEmbedding(parsed.freeText || query);
      // Fetch or generate embeddings for filtered candidates
      const candidateEmbeddings = await getOrGenerateEmbeddings(tenantId, filtered);

      for (const item of filtered) {
        const itemEmbedding = candidateEmbeddings.get(item.id);
        if (itemEmbedding) {
          const sim = cosineSimilarity(queryEmbedding, itemEmbedding);
          semanticScores.set(item.id, sim);
        }
      }
    } catch (err) {
      console.warn("Semantic embedding search unavailable, falling back to keyword search:", err);
      actualModeUsed = "keyword";
    }
  }

  // 5. Combine scores & determine match origin
  const scoredItems: SearchResultItem[] = [];
  let keywordCount = 0;
  let semanticCount = 0;
  let hybridCount = 0;

  for (const item of filtered) {
    const kw = keywordScores.get(item.id) ?? { score: 0, matchedFields: [] };
    const semScore = semanticScores.get(item.id) ?? 0;

    let finalScore = 0;
    let matchOrigin: "keyword" | "semantic" | "hybrid" = "keyword";
    const matchedFields = [...kw.matchedFields];

    if (actualModeUsed === "keyword") {
      finalScore = kw.score;
      matchOrigin = "keyword";
    } else if (actualModeUsed === "semantic") {
      finalScore = semScore;
      matchOrigin = "semantic";
      if (semScore > 0.45) {
        matchedFields.push("semantic meaning");
      }
    } else {
      // Hybrid mode: Weighted fusion
      // Keyword weight 0.55, Semantic weight 0.45
      const hasKwMatch = kw.score > 0.15;
      const hasSemMatch = semScore > 0.42;

      if (hasKwMatch && hasSemMatch) {
        finalScore = 0.55 * kw.score + 0.45 * semScore;
        matchOrigin = "hybrid";
        matchedFields.push("semantic meaning");
        hybridCount++;
      } else if (hasKwMatch) {
        finalScore = kw.score * 0.9;
        matchOrigin = "keyword";
        keywordCount++;
      } else if (hasSemMatch) {
        finalScore = semScore * 0.85;
        matchOrigin = "semantic";
        matchedFields.push("semantic meaning");
        semanticCount++;
      } else {
        finalScore = Math.max(kw.score * 0.5, semScore * 0.5);
        matchOrigin = kw.score >= semScore ? "keyword" : "semantic";
      }
    }

    // Threshold filtering: include if there is meaningful relevance
    const threshold = actualModeUsed === "semantic" ? 0.35 : 0.12;
    if (finalScore >= threshold || isSearchEmpty) {
      const cls = classifications.get(item.id);
      scoredItems.push({
        id: item.id,
        threadId: item.threadId,
        subject: item.subject,
        from: item.from,
        to: item.to,
        snippet: item.snippet,
        date: item.date,
        timestamp: item.timestamp,
        labelIds: item.labelIds,
        priority: cls?.priority,
        confidence: cls?.confidence,
        priorityReason: cls?.reason,
        matchOrigin,
        relevanceScore: Number(finalScore.toFixed(3)),
        matchedFields,
      });
    }
  }

  // Sort by relevance descending, then date descending
  scoredItems.sort((a, b) => {
    const diff = b.relevanceScore - a.relevanceScore;
    if (Math.abs(diff) > 0.05) return diff;
    return b.timestamp - a.timestamp;
  });

  const limit = filter?.limit ?? 50;
  const sliced = scoredItems.slice(0, limit);

  return {
    items: sliced,
    totalCount: scoredItems.length,
    modeUsed: actualModeUsed,
    stats: {
      keywordMatches: keywordCount,
      semanticMatches: semanticCount,
      hybridMatches: hybridCount,
    },
  };
}
