import { z } from "zod";

import {
  encodeRawEmail,
  extractBodyFromPayload,
  getHeader,
  looksLikeHtml,
} from "@/server/lib/email";
import { getTenant } from "@/server/lib/tenant";
import { corsair } from "@/server/corsair";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const optionalRecipientListSchema = z.string().trim().optional();
const requiredRecipientListSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value
        .split(",")
        .map((email) => email.trim())
        .every((email) => z.string().email().safeParse(email).success),
    "Invalid email address",
  );

function messageTimestamp(
  internalDate?: string | null,
  createdAt?: Date | null,
): number {
  if (internalDate) return Number(internalDate);
  if (createdAt) return createdAt.getTime();
  return 0;
}

function dedupeByEntityId<T extends { entity_id: string; updated_at: Date }>(
  items: T[],
): T[] {
  const byEntityId = new Map<string, T>();

  for (const item of items) {
    const existing = byEntityId.get(item.entity_id);

    if (!existing || item.updated_at > existing.updated_at) {
      byEntityId.set(item.entity_id, item);
    }
  }

  return Array.from(byEntityId.values());
}

export const gmailRouter = createTRPCRouter({
  checkConnection: protectedProcedure.query(async ({ ctx }) => {
    return corsair.manage.connectionStatus.get({
      tenantId: ctx.session.user.id,
    });
  }),

  searchEmails: protectedProcedure
    .input(
      paginationSchema.extend({
        query: z.string(),
        mailbox: z.enum(["inbox", "starred", "sent"]).default("inbox"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const labelIds = {
        inbox: ["INBOX"],
        starred: ["STARRED"],
        sent: ["SENT"],
      }[input.mailbox];

      const result = await tenant.gmail.api.messages.list({
        maxResults: input.limit,
        labelIds,
        q: input.query.trim() || undefined,
      });

      const messages = result.messages ?? [];

      const mappedMessages = await Promise.all(
        messages.map(async (message) => {
          if (!message.id) return null;

          const fullMessage = await tenant.gmail.api.messages.get({
            id: message.id,
            format: "full",
          });

          const headers = fullMessage.payload?.headers;

          return {
            id: fullMessage.id ?? message.id,
            threadId: fullMessage.threadId ?? "",
            snippet: fullMessage.snippet ?? "",
            subject: getHeader(headers, "Subject"),
            from: getHeader(headers, "From"),
            to: getHeader(headers, "To"),
            date:
              fullMessage.internalDate != null
                ? String(fullMessage.internalDate)
                : null,
            timestamp: messageTimestamp(
              fullMessage.internalDate != null
                ? String(fullMessage.internalDate)
                : null,
            ),
          };
        }),
      );

      return mappedMessages
        .filter(
          (message): message is NonNullable<typeof message> => message !== null,
        )
        .sort((a, b) => b.timestamp - a.timestamp);
    }),

  getMessage: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const cached = await tenant.gmail.db.messages.findByEntityId(input.id);

      if (cached?.data.body || cached?.data.subject) {
        const cachedData = cached.data as typeof cached.data & {
          bodyMimeType?: "text/plain" | "text/html";
          labelIds?: string[];
        };

        /*
         * Corsair's cached Gmail entity may not contain labelIds.
         * If label information is available, use the cache directly.
         * Otherwise fetch the current Gmail message so Star/Unstar state
         * is always accurate.
         */
        if (Array.isArray(cachedData.labelIds)) {
          const body = cachedData.body ?? cachedData.snippet ?? "";

          const bodyMimeType =
            cachedData.bodyMimeType ??
            (looksLikeHtml(body) ? "text/html" : "text/plain");

          return {
            id: cached.entity_id,
            threadId: cachedData.threadId ?? "",
            subject: cachedData.subject ?? "",
            from: cachedData.from ?? "",
            to: cachedData.to ?? "",
            body,
            bodyMimeType,
            snippet: cachedData.snippet ?? "",
            date: cachedData.internalDate ?? null,
            labelIds: cachedData.labelIds,
          };
        }
      }

      const message = await tenant.gmail.api.messages.get({
        id: input.id,
        format: "full",
      });

      const headers = message.payload?.headers;
      const extractedBody = extractBodyFromPayload(message.payload);

      const body = extractedBody.body
        ? extractedBody.body
        : (message.snippet ?? "");

      const bodyMimeType =
        extractedBody.body || !body
          ? extractedBody.bodyMimeType
          : looksLikeHtml(body)
            ? "text/html"
            : "text/plain";

      return {
        id: message.id ?? input.id,
        threadId: message.threadId ?? "",
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        body,
        bodyMimeType,
        snippet: message.snippet ?? "",
        date:
          message.internalDate != null ? String(message.internalDate) : null,
        labelIds: message.labelIds ?? [],
      };
    }),

  listDrafts: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const drafts = await tenant.gmail.db.drafts.list({
        limit: input.limit,
        offset: input.offset,
      });

      return dedupeByEntityId(drafts).map((draft) => ({
        id: draft.entity_id,
        messageId: draft.data.messageId ?? "",
        createdAt: draft.data.createdAt ?? null,
      }));
    }),

  refreshInbox: protectedProcedure.mutation(async ({ ctx }) => {
    const tenant = await getTenant(ctx.session.user.id);

    const result = await tenant.gmail.api.threads.list({
      maxResults: 50,
      labelIds: ["INBOX"],
    });

    return {
      synced: result.threads?.length ?? 0,
    };
  }),

  createDraft: protectedProcedure
    .input(
      z.object({
        to: requiredRecipientListSchema,
        cc: optionalRecipientListSchema,
        bcc: optionalRecipientListSchema,
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const raw = encodeRawEmail(input);

      const draft = await tenant.gmail.api.drafts.create({
        draft: {
          message: {
            raw,
          },
        },
      });

      return {
        id: draft.id ?? "",
        messageId: draft.message?.id ?? "",
      };
    }),

  sendDraft: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const message = await tenant.gmail.api.drafts.send({
        id: input.draftId,
      });

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
      };
    }),

  deleteMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      await tenant.gmail.api.messages.trash({
        id: input.messageId,
      });

      return {
        id: input.messageId,
      };
    }),

  deleteDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      await tenant.gmail.api.drafts.delete({
        id: input.draftId,
      });

      return {
        id: input.draftId,
      };
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        to: requiredRecipientListSchema,
        cc: optionalRecipientListSchema,
        bcc: optionalRecipientListSchema,
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const raw = encodeRawEmail(input);

      const message = await tenant.gmail.api.messages.send({
        raw,
      });

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
      };
    }),

  replyToMessage: protectedProcedure
    .input(
      z.object({
        threadId: z.string().min(1),
        to: z.string().email(),
        cc: optionalRecipientListSchema,
        bcc: optionalRecipientListSchema,
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const raw = encodeRawEmail({
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        body: input.body,
      });

      const message = await tenant.gmail.api.messages.send({
        raw,
        threadId: input.threadId,
      });

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? input.threadId,
      };
    }),

  modifyMessageLabels: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        addLabelIds: z.array(z.string()).optional(),
        removeLabelIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const message = await tenant.gmail.api.messages.modify({
        id: input.messageId,
        addLabelIds: input.addLabelIds,
        removeLabelIds: input.removeLabelIds,
      });

      return {
        id: message.id ?? input.messageId,
        threadId: message.threadId ?? "",
        labelIds: message.labelIds ?? [],
      };
    }),
});
