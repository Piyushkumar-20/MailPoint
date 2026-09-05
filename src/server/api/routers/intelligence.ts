import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getTenant, getTenantId } from "@/server/lib/tenant";
import {
  getExistingClassifications,
  getOrClassifyEmails,
  overrideEmailPriority,
  classifyEmailWithAI,
  PrioritySchema,
  type EmailMetadataForClassification,
} from "@/server/lib/email-intelligence";
import {
  executeIntelligentSearch,
  getOrGenerateEmbeddings,
  type CandidateEmail,
} from "@/server/lib/email-search";
import { db } from "@/server/db";
import { emailClassifications } from "@/server/db/schema";
import { getHeader } from "@/server/lib/email";

const emailMetadataSchema = z.object({
  id: z.string().min(1),
  subject: z.string().nullish(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  snippet: z.string().nullish(),
  body: z.string().nullish(),
  date: z.string().nullish(),
  labelIds: z.array(z.string()).nullish(),
});

function messageTimestamp(
  internalDate?: string | null,
  createdAt?: Date | null,
): number {
  if (internalDate) return Number(internalDate);
  if (createdAt) return createdAt.getTime();
  return 0;
}

export const intelligenceRouter = createTRPCRouter({
  /**
   * Fast lookup of existing classifications without triggering LLM calls.
   */
  getClassifications: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);
      const classificationsMap = await getExistingClassifications(
        tenantId,
        input.messageIds,
      );

      const result: Record<string, {
        id: string;
        priority: string;
        confidence: number;
        reason: string;
        category: string | null;
        userOverride: boolean;
      }> = {};

      for (const [messageId, item] of classificationsMap.entries()) {
        result[messageId] = {
          id: item.id,
          priority: item.priority,
          confidence: item.confidence,
          reason: item.reason,
          category: item.category,
          userOverride: item.userOverride,
        };
      }

      return result;
    }),

  /**
   * Progressive batch classification:
   * Reuses existing DB records; only calls Groq AI for unclassified emails.
   */
  classifyBatch: protectedProcedure
    .input(
      z.object({
        emails: z.array(emailMetadataSchema).max(50),
        forceReanalyzeIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);

      const itemsToProcess: EmailMetadataForClassification[] = input.emails.map((e) => ({
        id: e.id,
        subject: e.subject ?? null,
        from: e.from ?? null,
        to: e.to ?? null,
        snippet: e.snippet ?? null,
        body: e.body ?? null,
        date: e.date ?? null,
        labelIds: e.labelIds ?? null,
      }));

      const results = await getOrClassifyEmails(tenantId, itemsToProcess, {
        forceReanalyzeIds: input.forceReanalyzeIds,
      });

      const response: Record<string, {
        id: string;
        priority: string;
        confidence: number;
        reason: string;
        category: string | null;
        userOverride: boolean;
      }> = {};

      for (const [messageId, item] of results.entries()) {
        response[messageId] = {
          id: item.id,
          priority: item.priority,
          confidence: item.confidence,
          reason: item.reason,
          category: item.category,
          userOverride: item.userOverride,
        };
      }

      return response;
    }),

  /**
   * User manual priority override.
   * Marks userOverride = true so background classification preserves user choice.
   */
  overridePriority: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        priority: PrioritySchema,
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);
      const updated = await overrideEmailPriority(
        tenantId,
        input.messageId,
        input.priority,
        input.reason,
      );

      return {
        success: true,
        classification: {
          id: updated.id,
          messageId: updated.messageId,
          priority: updated.priority,
          confidence: updated.confidence,
          reason: updated.reason,
          category: updated.category,
          userOverride: updated.userOverride,
        },
      };
    }),

  /**
   * Explicit user action: Re-analyze with AI.
   * Forces a fresh AI analysis and updates the stored record.
   */
  reanalyzeEmail: protectedProcedure
    .input(
      z.object({
        email: emailMetadataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);
      const email = input.email;

      const aiResult = await classifyEmailWithAI({
        id: email.id,
        subject: email.subject ?? null,
        from: email.from ?? null,
        to: email.to ?? null,
        snippet: email.snippet ?? null,
        body: email.body ?? null,
        date: email.date ?? null,
        labelIds: email.labelIds ?? null,
      });

      const now = new Date();
      const recordId = crypto.randomUUID();

      const [upserted] = await db
        .insert(emailClassifications)
        .values({
          id: recordId,
          tenantId,
          messageId: email.id,
          priority: aiResult.priority,
          confidence: aiResult.confidence,
          reason: aiResult.reason,
          category: aiResult.category ?? null,
          userOverride: false,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [emailClassifications.tenantId, emailClassifications.messageId],
          set: {
            priority: aiResult.priority,
            confidence: aiResult.confidence,
            reason: aiResult.reason,
            category: aiResult.category ?? null,
            userOverride: false,
            updatedAt: now,
          },
        })
        .returning();

      return {
        id: upserted?.id ?? recordId,
        messageId: email.id,
        priority: aiResult.priority,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
        category: aiResult.category ?? null,
        userOverride: false,
      };
    }),

  /**
   * Multi-mode search: Keyword, Semantic, and Hybrid with operators and filters.
   */
  searchEmails: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        mode: z.enum(["hybrid", "semantic", "keyword"]).default("hybrid"),
        mailbox: z.enum(["inbox", "starred", "sent", "trash"]).default("inbox"),
        priority: z.enum(["all", "urgent", "important", "normal", "low", "high"]).default("all"),
        afterDate: z.string().optional(),
        beforeDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);
      const tenant = await getTenant(ctx.session.user.id);

      const labelIds = {
        inbox: ["INBOX"],
        starred: ["STARRED"],
        sent: ["SENT"],
        trash: ["TRASH"],
      }[input.mailbox];

      // 1. Gather candidates from local Corsair DB first
      const candidates: CandidateEmail[] = [];

      try {
        const cachedList = await tenant.gmail.db.messages.list({ limit: 100 });
        for (const item of cachedList) {
          const d = item.data as {
            subject?: string;
            from?: string;
            to?: string;
            snippet?: string;
            body?: string;
            internalDate?: string | null;
            threadId?: string;
            labelIds?: string[];
            payload?: { headers?: Array<{ name?: string; value?: string }> };
          };

          const cacheHeaders = d.payload?.headers;
          const subject = d.subject ?? getHeader(cacheHeaders, "Subject") ?? "";
          const from = d.from ?? getHeader(cacheHeaders, "From") ?? "";
          const to = d.to ?? getHeader(cacheHeaders, "To") ?? "";
          const labels = Array.isArray(d.labelIds) ? d.labelIds : [];

          candidates.push({
            id: item.entity_id,
            threadId: d.threadId ?? "",
            subject,
            from,
            to,
            snippet: d.snippet ?? "",
            body: d.body ?? "",
            date: d.internalDate ?? null,
            timestamp: messageTimestamp(d.internalDate ?? null),
            labelIds: labels,
          });
        }
      } catch (err) {
        console.warn("Failed to load local cached messages, fetching from API:", err);
      }

      // If local cache is empty, fetch recent messages from Gmail API to populate
      if (candidates.length === 0) {
        try {
          const apiResult = await tenant.gmail.api.messages.list({
            maxResults: 50,
            labelIds,
            includeSpamTrash: input.mailbox === "trash" ? true : undefined,
          });

          const msgIds = (apiResult.messages ?? []).map((m) => m.id).filter(Boolean);

          const fetched = await Promise.all(
            msgIds.slice(0, 30).map(async (id) => {
              if (!id) return null;
              try {
                const msg = await tenant.gmail.api.messages.get({ id, format: "metadata" });
                const headers = msg.payload?.headers;
                return {
                  id: msg.id ?? id,
                  threadId: msg.threadId ?? "",
                  snippet: msg.snippet ?? "",
                  subject: getHeader(headers, "Subject") ?? "",
                  from: getHeader(headers, "From") ?? "",
                  to: getHeader(headers, "To") ?? "",
                  date: msg.internalDate != null ? String(msg.internalDate) : null,
                  timestamp: messageTimestamp(msg.internalDate != null ? String(msg.internalDate) : null),
                  labelIds: msg.labelIds ?? [],
                };
              } catch {
                return null;
              }
            }),
          );

          for (const item of fetched) {
            if (item) candidates.push(item);
          }
        } catch (apiErr) {
          console.error("Failed to fetch messages for search:", apiErr);
        }
      }

      // 2. Run intelligent multi-mode search
      const searchResult = await executeIntelligentSearch({
        tenantId,
        candidates,
        query: input.query,
        mode: input.mode,
        filter: {
          mailbox: input.mailbox,
          priority: input.priority,
          afterDate: input.afterDate,
          beforeDate: input.beforeDate,
          limit: input.limit,
        },
      });

      return searchResult;
    }),

  /**
   * Pre-index embeddings in background for tenant's cached emails.
   */
  indexEmbeddings: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);
      const tenant = await getTenant(ctx.session.user.id);

      try {
        const cached = await tenant.gmail.db.messages.list({ limit: input.limit });
        const items = cached.map((c) => {
          const d = c.data as {
            subject?: string;
            from?: string;
            snippet?: string;
            body?: string;
          };
          return {
            id: c.entity_id,
            subject: d.subject ?? null,
            from: d.from ?? null,
            snippet: d.snippet ?? null,
            body: d.body ?? null,
          };
        });

        const embeddings = await getOrGenerateEmbeddings(tenantId, items);
        return {
          success: true,
          indexedCount: embeddings.size,
        };
      } catch (err) {
        console.error("Failed to index embeddings:", err);
        return {
          success: false,
          indexedCount: 0,
        };
      }
    }),
});
