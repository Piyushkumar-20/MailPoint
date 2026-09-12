import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getTenantId } from "@/server/lib/tenant";
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
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { emailClassifications, gmailMessages } from "@/server/db/schema";

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

      // 1. Gather candidates from local MailPoint gmail_messages read model
      const labelFilter =
        input.mailbox === "inbox"
          ? eq(gmailMessages.isInbox, true)
          : input.mailbox === "starred"
            ? eq(gmailMessages.isStarred, true)
            : input.mailbox === "sent"
              ? eq(gmailMessages.isSent, true)
              : eq(gmailMessages.isTrash, true);

      const rows = await db.query.gmailMessages.findMany({
        where: and(eq(gmailMessages.tenantId, tenantId), labelFilter),
        orderBy: [desc(gmailMessages.internalDate)],
        limit: 100,
      });

      const candidates: CandidateEmail[] = rows.map((row) => ({
        id: row.messageId,
        threadId: row.threadId,
        subject: row.subject,
        from: row.fromAddress,
        to: row.toAddress,
        snippet: row.snippet,
        body: row.body ?? undefined,
        date: row.internalDate ?? null,
        timestamp: messageTimestamp(row.internalDate),
        labelIds: Array.isArray(row.labelIds) ? (row.labelIds as string[]) : [],
      }));

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

      try {
        const rows = await db.query.gmailMessages.findMany({
          where: eq(gmailMessages.tenantId, tenantId),
          orderBy: [desc(gmailMessages.internalDate)],
          limit: input.limit,
        });

        const items = rows.map((r) => ({
          id: r.messageId,
          subject: r.subject !== "" ? r.subject : null,
          from: r.fromAddress !== "" ? r.fromAddress : null,
          snippet: r.snippet !== "" ? r.snippet : null,
          body: r.body ?? null,
        }));

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
