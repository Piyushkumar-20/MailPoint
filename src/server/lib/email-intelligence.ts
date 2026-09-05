import OpenAI from "openai";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { emailClassifications } from "@/server/db/schema";

export const PrioritySchema = z.enum(["urgent", "important", "normal", "low"]);
export type PriorityLevel = z.infer<typeof PrioritySchema>;

export const ClassificationResultSchema = z.object({
  priority: PrioritySchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  category: z.string().optional(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export interface EmailMetadataForClassification {
  id: string;
  subject?: string | null;
  from?: string | null;
  to?: string | null;
  snippet?: string | null;
  body?: string | null;
  date?: string | null;
  labelIds?: string[] | null;
}

export interface StoredClassification {
  id: string;
  tenantId: string;
  messageId: string;
  priority: PriorityLevel;
  confidence: number;
  reason: string;
  category: string | null;
  userOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function getGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is missing.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

/**
 * Fallback heuristic classifier used ONLY when Groq AI is temporarily unavailable.
 */
function heuristicClassify(email: EmailMetadataForClassification): ClassificationResult {
  const text = `${email.subject ?? ""} ${email.snippet ?? ""} ${email.from ?? ""}`.toLowerCase();

  const urgentPatterns = [
    "urgent",
    "emergency",
    "action required immediately",
    "production down",
    "critical incident",
    "security alert",
    "password compromised",
    "payment failed",
    "server error 500",
    "immediate action",
    "service outage",
    "p0",
    "p1",
  ];

  const importantPatterns = [
    "deadline",
    "interview",
    "contract",
    "proposal",
    "invoice",
    "wire transfer",
    "offer letter",
    "client request",
    "flight confirmation",
    "boarding pass",
    "calendar invite",
    "meeting scheduled",
    "action required",
    "tax document",
    "statement ready",
  ];

  const lowPatterns = [
    "unsubscribe",
    "newsletter",
    "promotions",
    "sale ends",
    "off your order",
    "marketing",
    "digest",
    "no-reply",
    "noreply",
    "donotreply",
    "weekly update",
    "coupon",
    "black friday",
    "special offer",
  ];

  for (const pattern of urgentPatterns) {
    if (text.includes(pattern)) {
      return {
        priority: "urgent",
        confidence: 0.85,
        reason: `Matched critical urgency indicator: "${pattern}"`,
        category: "Urgent Action",
      };
    }
  }

  for (const pattern of importantPatterns) {
    if (text.includes(pattern)) {
      return {
        priority: "important",
        confidence: 0.8,
        reason: `Contains important business correspondence keyword: "${pattern}"`,
        category: "Important Communication",
      };
    }
  }

  for (const pattern of lowPatterns) {
    if (text.includes(pattern)) {
      return {
        priority: "low",
        confidence: 0.85,
        reason: `Appears to be automated or promotional content: "${pattern}"`,
        category: "Automated/Promotional",
      };
    }
  }

  return {
    priority: "normal",
    confidence: 0.75,
    reason: "Standard correspondence without high urgency indicators.",
    category: "General",
  };
}

/**
 * Classifies an email using Groq's LLM with validated structured JSON output.
 */
export async function classifyEmailWithAI(
  email: EmailMetadataForClassification,
): Promise<ClassificationResult> {
  const contentSnippet = (email.body ?? email.snippet ?? "").slice(0, 1500);

  const prompt = `You are MailPoint's AI email priority classifier.
Analyze the following email metadata and determine its priority level.

Priority Levels:
- "urgent": Imminent deadlines (today/tomorrow), critical security issues, severe operational problems, outages, or actions requiring immediate attention.
- "important": High-value business decisions, direct colleague/client communication, important schedule or financial updates, contracts, interviews, invoices.
- "normal": Routine correspondence, standard work updates, personal messages, standard informational emails.
- "low": Promotional emails, marketing blasts, social notifications, automated bulk newsletters, low-value spam-like updates.

Email to analyze:
- From: ${email.from ?? "Unknown"}
- To: ${email.to ?? "Unknown"}
- Subject: ${email.subject ?? "(no subject)"}
- Date: ${email.date ?? "Unknown"}
- Labels: ${(email.labelIds ?? []).join(", ") || "None"}
- Content:
${contentSnippet}

Return a valid JSON object matching this schema:
{
  "priority": "urgent" | "important" | "normal" | "low",
  "confidence": <number between 0.0 and 1.0>,
  "reason": "<one concise sentence explaining why this priority was assigned>",
  "category": "<optional 1-3 word category, e.g. 'Security Alert', 'Client Meeting', 'Newsletter'>"
}`;

  try {
    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "You are an expert AI email intelligence classifier for MailPoint. You evaluate email importance accurately and concisely. Always respond with pure JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 250,
    });

    const rawText = response.choices[0]?.message?.content ?? "{}";
    const parsed: unknown = JSON.parse(rawText);
    const raw = parsed as {
      priority?: unknown;
      confidence?: unknown;
      reason?: unknown;
      category?: unknown;
    };

    // Normalize priority to lowercase
    if (typeof raw.priority === "string") {
      raw.priority = raw.priority.toLowerCase();
    }
    // Ensure confidence is within range
    if (typeof raw.confidence === "number") {
      raw.confidence = Math.max(0, Math.min(1, raw.confidence));
    } else {
      raw.confidence = 0.85;
    }

    const validated = ClassificationResultSchema.safeParse(raw);
    if (validated.success) {
      return validated.data;
    }

    console.warn("Groq classification validation failed, parsing error:", validated.error);
    return heuristicClassify(email);
  } catch (error) {
    console.error("Groq AI classification error, falling back to heuristic:", error);
    return heuristicClassify(email);
  }
}

/**
 * Fetch existing stored classifications for a tenant and message IDs.
 * Reuses existing classifications and avoids repeated LLM calls.
 */
export async function getExistingClassifications(
  tenantId: string,
  messageIds: string[],
): Promise<Map<string, StoredClassification>> {
  const result = new Map<string, StoredClassification>();
  if (messageIds.length === 0) return result;

  const records = await db
    .select()
    .from(emailClassifications)
    .where(
      and(
        eq(emailClassifications.tenantId, tenantId),
        inArray(emailClassifications.messageId, messageIds),
      ),
    );

  for (const record of records) {
    result.set(record.messageId, {
      id: record.id,
      tenantId: record.tenantId,
      messageId: record.messageId,
      priority: record.priority as PriorityLevel,
      confidence: record.confidence,
      reason: record.reason,
      category: record.category,
      userOverride: record.userOverride,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  return result;
}

/**
 * Classify a batch of emails for a tenant:
 * 1. Retrieves already classified emails from DB (cache reuse).
 * 2. For unclassified emails (or if forceReanalyze is true without user override),
 *    runs concurrent LLM classification in controlled batches.
 * 3. Persists new classifications into DB.
 */
export async function getOrClassifyEmails(
  tenantId: string,
  emails: EmailMetadataForClassification[],
  options?: { forceReanalyzeIds?: string[] },
): Promise<Map<string, StoredClassification>> {
  const resultMap = new Map<string, StoredClassification>();
  if (emails.length === 0) return resultMap;

  const messageIds = emails.map((e) => e.id);
  const existing = await getExistingClassifications(tenantId, messageIds);

  const forceIds = new Set(options?.forceReanalyzeIds ?? []);
  const toClassify: EmailMetadataForClassification[] = [];

  for (const email of emails) {
    const existingRecord = existing.get(email.id);
    const shouldForce = forceIds.has(email.id);

    if (existingRecord) {
      if (shouldForce) {
        toClassify.push(email);
      } else {
        resultMap.set(email.id, existingRecord);
      }
    } else {
      toClassify.push(email);
    }
  }

  if (toClassify.length === 0) {
    return resultMap;
  }

  // Controlled concurrency batching: classify up to 5 concurrently
  const CONCURRENCY_LIMIT = 5;
  for (let i = 0; i < toClassify.length; i += CONCURRENCY_LIMIT) {
    const slice = toClassify.slice(i, i + CONCURRENCY_LIMIT);

    const promises = slice.map(async (email) => {
      const classification = await classifyEmailWithAI(email);
      const recordId = crypto.randomUUID();
      const now = new Date();

      try {
        const [upserted] = await db
          .insert(emailClassifications)
          .values({
            id: recordId,
            tenantId,
            messageId: email.id,
            priority: classification.priority,
            confidence: classification.confidence,
            reason: classification.reason,
            category: classification.category ?? null,
            userOverride: false,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [emailClassifications.tenantId, emailClassifications.messageId],
            set: {
              priority: classification.priority,
              confidence: classification.confidence,
              reason: classification.reason,
              category: classification.category ?? null,
              userOverride: false,
              updatedAt: now,
            },
          })
          .returning();

        if (upserted) {
          resultMap.set(email.id, {
            id: upserted.id,
            tenantId: upserted.tenantId,
            messageId: upserted.messageId,
            priority: upserted.priority as PriorityLevel,
            confidence: upserted.confidence,
            reason: upserted.reason,
            category: upserted.category,
            userOverride: upserted.userOverride,
            createdAt: upserted.createdAt,
            updatedAt: upserted.updatedAt,
          });
        }
      } catch (err) {
        console.error(`Failed to persist classification for email ${email.id}:`, err);
        // Even if persistence fails, return classification in memory
        resultMap.set(email.id, {
          id: recordId,
          tenantId,
          messageId: email.id,
          priority: classification.priority,
          confidence: classification.confidence,
          reason: classification.reason,
          category: classification.category ?? null,
          userOverride: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    await Promise.all(promises);
  }

  return resultMap;
}

/**
 * Handle user manual priority override.
 * Sets userOverride = true and preserves the choice against background AI runs.
 */
export async function overrideEmailPriority(
  tenantId: string,
  messageId: string,
  priority: PriorityLevel,
  reason = "Manually adjusted by user",
): Promise<StoredClassification> {
  const now = new Date();
  const id = crypto.randomUUID();

  const [upserted] = await db
    .insert(emailClassifications)
    .values({
      id,
      tenantId,
      messageId,
      priority,
      confidence: 1.0,
      reason,
      category: "User Override",
      userOverride: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [emailClassifications.tenantId, emailClassifications.messageId],
      set: {
        priority,
        confidence: 1.0,
        reason,
        category: "User Override",
        userOverride: true,
        updatedAt: now,
      },
    })
    .returning();

  if (!upserted) {
    throw new Error("Failed to update priority override");
  }

  return {
    id: upserted.id,
    tenantId: upserted.tenantId,
    messageId: upserted.messageId,
    priority: upserted.priority as PriorityLevel,
    confidence: upserted.confidence,
    reason: upserted.reason,
    category: upserted.category,
    userOverride: upserted.userOverride,
    createdAt: upserted.createdAt,
    updatedAt: upserted.updatedAt,
  };
}
