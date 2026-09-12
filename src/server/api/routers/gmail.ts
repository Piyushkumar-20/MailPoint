import { z } from "zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";

import {
  encodeRawEmail,
  extractBodyFromPayload,
  getHeader,
  looksLikeHtml,
} from "@/server/lib/email";
import { getTenant, getTenantId } from "@/server/lib/tenant";
import { corsair } from "@/server/corsair";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { gmailMessages, gmailSyncState } from "@/server/db/schema";
import {
  triggerBackgroundSync,
  upsertGmailMessage,
  updateMessageLabels,
  deleteLocalMessage,
  deleteLocalMessages,
  cacheMessageBody,
} from "@/server/lib/gmail-sync";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function messageTimestamp(internalDate?: string | null): number {
  if (internalDate) return Number(internalDate);
  return 0;
}

type TenantInstance = Awaited<ReturnType<typeof getTenant>>;

/**
 * Refresh Gmail access token – identical logic to before, kept here so all
 * Gmail API interactions remain in this file (sync service has its own copy
 * for the background path).
 */
async function getGmailAccessToken(tenant: TenantInstance): Promise<string> {
  const [accessToken, expiresAt, refreshToken] = await Promise.all([
    tenant.gmail.keys.get_access_token(),
    tenant.gmail.keys.get_expires_at(),
    tenant.gmail.keys.get_refresh_token(),
  ]);

  const now = Math.floor(Date.now() / 1000);
  if (accessToken && expiresAt && Number(expiresAt) > now + 300) {
    return accessToken;
  }

  if (!refreshToken) {
    if (accessToken) return accessToken;
    throw new Error("Gmail refresh token is missing");
  }

  const credentials = await tenant.gmail.keys.get_integration_credentials();
  const clientId = credentials.client_id ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    credentials.client_secret ?? process.env.GOOGLE_CLIENT_SECRET;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    if (accessToken) return accessToken;
    throw new Error(
      `Failed to refresh Gmail access token: ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  const newAccessToken = data.access_token;
  const newExpiresAt = now + data.expires_in;

  await Promise.all([
    tenant.gmail.keys.set_access_token(newAccessToken),
    tenant.gmail.keys.set_expires_at(String(newExpiresAt)),
  ]);

  return newAccessToken;
}

/**
 * Permanently delete one Gmail message and remove it from the local index.
 * Retries on 429 with exponential back-off.
 */
async function permanentlyDeleteGmailMessage(
  tenant: TenantInstance,
  tenantId: string,
  messageId: string,
) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const accessToken = await getGmailAccessToken(tenant);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (response.ok || response.status === 204 || response.status === 404) {
      break;
    }

    const errorText = await response.text();

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (
      response.status === 403 &&
      (errorText.includes("insufficient") ||
        errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
        errorText.includes("insufficientPermissions"))
    ) {
      throw new Error(
        "Google authorization needs to be updated. Please reconnect your Google account to enable permanent deletion.",
      );
    }

    throw new Error(
      `Gmail permanent delete failed (${response.status}): ${errorText}`,
    );
  }

  // Remove from local index
  await deleteLocalMessage(tenantId, messageId);
  // Also clean up Corsair cache if present
  await tenant.gmail.db?.messages
    ?.deleteByEntityId(messageId)
    .catch(() => undefined);
}

/**
 * Batch-delete messages via Gmail batchDelete API, then remove from local index.
 */
async function batchDeleteGmailMessages(
  tenant: TenantInstance,
  tenantId: string,
  messageIds: string[],
) {
  if (messageIds.length === 0) return;

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const accessToken = await getGmailAccessToken(tenant);

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: messageIds }),
      },
    );

    if (response.ok || response.status === 204 || response.status === 404) {
      break;
    }

    const errorText = await response.text();

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (
      response.status === 403 &&
      (errorText.includes("insufficient") ||
        errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
        errorText.includes("insufficientPermissions"))
    ) {
      throw new Error(
        "Google authorization needs to be updated. Please reconnect your Google account to enable permanent deletion.",
      );
    }

    throw new Error(
      `Gmail batch delete failed (${response.status}): ${errorText}`,
    );
  }

  // Remove from local index (batch)
  await deleteLocalMessages(tenantId, messageIds);
  // Clean up Corsair cache
  await Promise.all(
    messageIds.map((id) =>
      tenant.gmail.db?.messages?.deleteByEntityId(id).catch(() => undefined),
    ),
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const gmailRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Connection / sync status
  // -------------------------------------------------------------------------

  checkConnection: protectedProcedure.query(async ({ ctx }) => {
    return corsair.manage.connectionStatus.get({
      tenantId: ctx.session.user.id,
    });
  }),

  /**
   * Returns the current Gmail synchronisation state for the UI banner.
   * Fast — single DB lookup, no Gmail API call.
   */
  getSyncStatus: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = await getTenantId(ctx.session.user.id);
    const state = await db.query.gmailSyncState.findFirst({
      where: eq(gmailSyncState.tenantId, tenantId),
    });
    return {
      status: state?.status ?? "initial_sync_required",
      lastSyncedAt: state?.lastSyncedAt ?? null,
      lastError: state?.lastError ?? null,
      initialSyncCompletedAt: state?.initialSyncCompletedAt ?? null,
    };
  }),

  /**
   * Explicit sync trigger — called by the UI refresh button or after actions
   * that the caller knows should update the index (e.g. sendEmail).
   * Fire-and-forget: returns immediately; sync runs in background.
   */
  triggerSync: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = await getTenantId(ctx.session.user.id);
    const tenant = await getTenant(ctx.session.user.id);
    triggerBackgroundSync(tenantId, tenant as Parameters<typeof triggerBackgroundSync>[1], db);
    const state = await db.query.gmailSyncState.findFirst({
      where: eq(gmailSyncState.tenantId, tenantId),
    });
    return { status: state?.status ?? "syncing" };
  }),

  // -------------------------------------------------------------------------
  // Mailbox query — pure Postgres read model query
  // Normal inbox/starred/sent/trash renders hit this.
  // Architecture: one DB query, zero Gmail API calls, zero sync triggers.
  // -------------------------------------------------------------------------

  /**
   * searchEmails — fast read-only mailbox query from the local index.
   *
   * Performance:
   *   - One tenant resolution
   *   - One Postgres query (with indexes on label flags + internalDate)
   *   - Zero Corsair findByEntityId calls
   *   - Zero Gmail messages.get calls
   *   - Zero sync triggers / sync state creation
   *   - Pagination via limit/offset
   */
  searchEmails: protectedProcedure
    .input(
      paginationSchema.extend({
        query: z.string().default(""),
        mailbox: z
          .enum(["inbox", "starred", "sent", "trash"])
          .default("inbox"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = await getTenantId(ctx.session.user.id);

      // Build mailbox filter
      const labelFilter =
        input.mailbox === "inbox"
          ? eq(gmailMessages.isInbox, true)
          : input.mailbox === "starred"
            ? eq(gmailMessages.isStarred, true)
            : input.mailbox === "sent"
              ? eq(gmailMessages.isSent, true)
              : eq(gmailMessages.isTrash, true);

      const trimmedQuery = input.query.trim();

      // Build search conditions (only applied when user typed a query)
      const searchCondition =
        trimmedQuery.length > 0
          ? or(
              ilike(gmailMessages.subject, `%${trimmedQuery}%`),
              ilike(gmailMessages.fromAddress, `%${trimmedQuery}%`),
              ilike(gmailMessages.snippet, `%${trimmedQuery}%`),
              ilike(gmailMessages.toAddress, `%${trimmedQuery}%`),
            )
          : undefined;

      const whereClause = and(
        eq(gmailMessages.tenantId, tenantId),
        labelFilter,
        ...(searchCondition ? [searchCondition] : []),
      );

      const startMs = Date.now();

      const rows = await db.query.gmailMessages.findMany({
        where: whereClause,
        orderBy: [desc(gmailMessages.internalDate)],
        limit: input.limit,
        offset: input.offset,
        columns: {
          // Return list metadata (A) only — no body
          messageId: true,
          threadId: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          snippet: true,
          internalDate: true,
          labelIds: true,
          isUnread: true,
          isStarred: true,
          isInbox: true,
          isSent: true,
          isTrash: true,
        },
      });

      const dbDurationMs = Date.now() - startMs;

      console.log(
        `[gmail.searchEmails] tenant=${tenantId} mailbox=${input.mailbox} ` +
          `query="${trimmedQuery}" count=${rows.length} dbMs=${dbDurationMs}`,
      );

      return rows.map((row) => ({
        id: row.messageId,
        threadId: row.threadId,
        subject: row.subject,
        from: row.fromAddress,
        to: row.toAddress,
        snippet: row.snippet,
        date: row.internalDate ?? null,
        timestamp: messageTimestamp(row.internalDate),
        labelIds: Array.isArray(row.labelIds) ? (row.labelIds as string[]) : [],
      }));
    }),

  // -------------------------------------------------------------------------
  // getMessage — lazy body fetch
  // -------------------------------------------------------------------------

  /**
   * Fetches a single message for the reading pane.
   *
   * Flow:
   *   1. Query gmail_messages by (tenantId, messageId)
   *   2. If bodyStored=true → return cached body immediately
   *   3. Else → fetch from Gmail API (format: "full"), cache body, return
   *
   * The list metadata (from/to/subject/snippet) is always returned from
   * the local index even when fetching the body from Gmail.
   */
  getMessage: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const t0 = Date.now();
      const tenantId = await getTenantId(ctx.session.user.id);

      // 1. Read from local index
      const localRow = await db.query.gmailMessages.findFirst({
        where: and(
          eq(gmailMessages.tenantId, tenantId),
          eq(gmailMessages.messageId, input.id),
        ),
      });

      if (localRow?.bodyStored) {
        // Fast path: body already cached
        console.log(
          `[gmail.getMessage] Cache HIT for ${input.id} (tenant=${tenantId}) in ${Date.now() - t0}ms`,
        );
        const body = localRow.body ?? localRow.snippet ?? "";
        const bodyMimeType =
          (localRow.bodyMimeType as "text/plain" | "text/html" | null) ??
          (looksLikeHtml(body) ? "text/html" : "text/plain");

        return {
          id: localRow.messageId,
          threadId: localRow.threadId,
          subject: localRow.subject,
          from: localRow.fromAddress,
          to: localRow.toAddress,
          body,
          bodyMimeType,
          snippet: localRow.snippet,
          date: localRow.internalDate ?? null,
          labelIds: Array.isArray(localRow.labelIds)
            ? (localRow.labelIds as string[])
            : [],
        };
      }

      // 2. Fetch full message from Gmail
      const t1 = Date.now();
      const tenant = await getTenant(ctx.session.user.id);

      const message = await tenant.gmail.api.messages.get({
        id: input.id,
        format: "full",
      });

      const headers = message.payload?.headers ?? [];
      const extractedBody = extractBodyFromPayload(message.payload);
      const body = extractedBody.body ? extractedBody.body : (message.snippet ?? "");
      const bodyMimeType: "text/plain" | "text/html" =
        extractedBody.body || !body
          ? extractedBody.bodyMimeType
          : looksLikeHtml(body)
            ? "text/html"
            : "text/plain";

      // 3. If the message is in our index, cache the body for future reads
      if (localRow) {
        // Best-effort cache write — don't fail the request if it errors
        void cacheMessageBody(tenantId, input.id, body, bodyMimeType, db).catch(
          (err) => console.warn("[gmail.getMessage] Failed to cache body:", err),
        );
      } else {
        // Message not yet in index — upsert it (e.g. user opened a message
        // before sync completed)
        void upsertGmailMessage(tenantId, message, db).catch((err) =>
          console.warn("[gmail.getMessage] Failed to upsert message:", err),
        );
      }

      console.log(
        `[gmail.getMessage] Cache MISS for ${input.id} (tenant=${tenantId}). ` +
          `indexMs=${t1 - t0} gmailMs=${Date.now() - t1} totalMs=${Date.now() - t0}`,
      );

      return {
        id: message.id ?? input.id,
        threadId: message.threadId ?? localRow?.threadId ?? "",
        subject: getHeader(headers, "Subject") !== "" ? getHeader(headers, "Subject") : (localRow?.subject ?? ""),
        from: getHeader(headers, "From") !== "" ? getHeader(headers, "From") : (localRow?.fromAddress ?? ""),
        to: getHeader(headers, "To") !== "" ? getHeader(headers, "To") : (localRow?.toAddress ?? ""),
        body,
        bodyMimeType,
        snippet: message.snippet ?? localRow?.snippet ?? "",
        date: message.internalDate != null
          ? String(message.internalDate)
          : localRow?.internalDate ?? null,
        labelIds: message.labelIds ?? [],
      };
    }),

  // -------------------------------------------------------------------------
  // Drafts (unchanged — uses Corsair draft store, not gmail_messages)
  // -------------------------------------------------------------------------

  listDrafts: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

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

  // -------------------------------------------------------------------------
  // Compose / send / reply
  // -------------------------------------------------------------------------

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
        draft: { message: { raw } },
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

      // Trigger incremental sync so sent message appears in index
      const tenantId = await getTenantId(ctx.session.user.id);
      triggerBackgroundSync(tenantId, tenant as Parameters<typeof triggerBackgroundSync>[1], db);

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
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

      const message = await tenant.gmail.api.messages.send({ raw });

      // Trigger sync so sent item appears in Sent mailbox
      const tenantId = await getTenantId(ctx.session.user.id);
      triggerBackgroundSync(tenantId, tenant as Parameters<typeof triggerBackgroundSync>[1], db);

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

      // Trigger sync so reply appears in Sent
      const tenantId = await getTenantId(ctx.session.user.id);
      triggerBackgroundSync(tenantId, tenant as Parameters<typeof triggerBackgroundSync>[1], db);

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? input.threadId,
      };
    }),

  // -------------------------------------------------------------------------
  // Label mutations — perform Gmail action then update local index
  // -------------------------------------------------------------------------

  modifyMessageLabels: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        addLabelIds: z.array(z.string()).optional(),
        removeLabelIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      const message = await tenant.gmail.api.messages.modify({
        id: input.messageId,
        addLabelIds: input.addLabelIds,
        removeLabelIds: input.removeLabelIds,
      });

      const newLabelIds = message.labelIds ?? [];

      // Update local index immediately (optimistic — avoids waiting for sync)
      void updateMessageLabels(tenantId, input.messageId, newLabelIds, db).catch(
        (err) =>
          console.warn("[gmail.modifyMessageLabels] Index update failed:", err),
      );

      return {
        id: message.id ?? input.messageId,
        threadId: message.threadId ?? "",
        labelIds: newLabelIds,
      };
    }),

  modifyMessagesLabels: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
        addLabelIds: z.array(z.string()).optional(),
        removeLabelIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      const messages = await Promise.all(
        input.messageIds.map((messageId) =>
          tenant.gmail.api.messages.modify({
            id: messageId,
            addLabelIds: input.addLabelIds,
            removeLabelIds: input.removeLabelIds,
          }),
        ),
      );

      // Update local index for each message
      for (const [i, message] of messages.entries()) {
        const messageId = input.messageIds[i];
        if (!messageId) continue;
        const newLabelIds = message.labelIds ?? [];
        void updateMessageLabels(tenantId, messageId, newLabelIds, db).catch(
          (err) =>
            console.warn(
              "[gmail.modifyMessagesLabels] Index update failed:",
              err,
            ),
        );
      }

      return {
        messages: messages.map((message, index) => ({
          id: message.id ?? input.messageIds[index],
          labelIds: message.labelIds ?? [],
        })),
      };
    }),

  // -------------------------------------------------------------------------
  // Trash / restore
  // -------------------------------------------------------------------------

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      await tenant.gmail.api.messages.trash({ id: input.messageId });

      // Reflect trash state in index: add TRASH, remove INBOX
      const localRow = await db.query.gmailMessages.findFirst({
        where: and(
          eq(gmailMessages.tenantId, tenantId),
          eq(gmailMessages.messageId, input.messageId),
        ),
        columns: { labelIds: true },
      });

      if (localRow) {
        const existing = Array.isArray(localRow.labelIds)
          ? (localRow.labelIds as string[])
          : [];
        const updated = Array.from(
          new Set([...existing.filter((l) => l !== "INBOX"), "TRASH"]),
        );
        void updateMessageLabels(tenantId, input.messageId, updated, db).catch(
          () => undefined,
        );
      }

      return { id: input.messageId };
    }),

  deleteMessages: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      await Promise.all(
        input.messageIds.map((messageId) =>
          tenant.gmail.api.messages.trash({ id: messageId }),
        ),
      );

      // Update local index: move each to trash
      for (const messageId of input.messageIds) {
        const localRow = await db.query.gmailMessages.findFirst({
          where: and(
            eq(gmailMessages.tenantId, tenantId),
            eq(gmailMessages.messageId, messageId),
          ),
          columns: { labelIds: true },
        });
        if (localRow) {
          const existing = Array.isArray(localRow.labelIds)
            ? (localRow.labelIds as string[])
            : [];
          const updated = Array.from(
            new Set([...existing.filter((l) => l !== "INBOX"), "TRASH"]),
          );
          void updateMessageLabels(tenantId, messageId, updated, db).catch(
            () => undefined,
          );
        }
      }

      return { ids: input.messageIds };
    }),

  restoreMessage: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      const message = await tenant.gmail.api.messages.modify({
        id: input.messageId,
        addLabelIds: ["INBOX"],
        removeLabelIds: ["TRASH"],
      });

      const newLabelIds = message.labelIds ?? [];
      void updateMessageLabels(tenantId, input.messageId, newLabelIds, db).catch(
        () => undefined,
      );

      return {
        id: message.id ?? input.messageId,
        labelIds: newLabelIds,
      };
    }),

  restoreMessages: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      const messages = await Promise.all(
        input.messageIds.map((messageId) =>
          tenant.gmail.api.messages.modify({
            id: messageId,
            addLabelIds: ["INBOX"],
            removeLabelIds: ["TRASH"],
          }),
        ),
      );

      for (const [i, message] of messages.entries()) {
        const messageId = input.messageIds[i];
        if (!messageId) continue;
        void updateMessageLabels(tenantId, messageId, message.labelIds ?? [], db).catch(
          () => undefined,
        );
      }

      return {
        messages: messages.map((message, index) => ({
          id: message.id ?? input.messageIds[index],
          labelIds: message.labelIds ?? [],
        })),
      };
    }),

  // -------------------------------------------------------------------------
  // Permanent delete
  // -------------------------------------------------------------------------

  deleteMessagePermanently: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      await permanentlyDeleteGmailMessage(tenant, tenantId, input.messageId);

      return { id: input.messageId };
    }),

  deleteMessagesPermanently: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant, tenantId] = await Promise.all([
        getTenant(ctx.session.user.id),
        getTenantId(ctx.session.user.id),
      ]);

      await batchDeleteGmailMessages(tenant, tenantId, input.messageIds);

      return { ids: input.messageIds };
    }),

  emptyTrash: protectedProcedure.mutation(async ({ ctx }) => {
    const [tenant, tenantId] = await Promise.all([
      getTenant(ctx.session.user.id),
      getTenantId(ctx.session.user.id),
    ]);

    const result = await tenant.gmail.api.messages.list({
      labelIds: ["TRASH"],
      includeSpamTrash: true,
      maxResults: 100,
    });

    const messages = result.messages ?? [];
    const messageIds = messages
      .map((message) => message.id)
      .filter((id): id is string => Boolean(id));

    if (messageIds.length > 0) {
      await batchDeleteGmailMessages(tenant, tenantId, messageIds);
    }

    return { deletedCount: messageIds.length };
  }),

  // -------------------------------------------------------------------------
  // Draft delete
  // -------------------------------------------------------------------------

  deleteDraft: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);
      await tenant.gmail.api.drafts.delete({ id: input.draftId });
      return { id: input.draftId };
    }),

  // -------------------------------------------------------------------------
  // refreshInbox — backward-compat shim (now delegates to triggerSync)
  // -------------------------------------------------------------------------

  refreshInbox: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = await getTenantId(ctx.session.user.id);
    const tenant = await getTenant(ctx.session.user.id);
    triggerBackgroundSync(tenantId, tenant as Parameters<typeof triggerBackgroundSync>[1], db);
    return { synced: 0 };
  }),
});
