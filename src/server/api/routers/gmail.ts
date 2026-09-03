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

type TenantInstance = Awaited<ReturnType<typeof getTenant>>;

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
  const clientSecret = credentials.client_secret ?? process.env.GOOGLE_CLIENT_SECRET;

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
    throw new Error(`Failed to refresh Gmail access token: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const newAccessToken = data.access_token;
  const newExpiresAt = now + data.expires_in;

  await Promise.all([
    tenant.gmail.keys.set_access_token(newAccessToken),
    tenant.gmail.keys.set_expires_at(String(newExpiresAt)),
  ]);

  return newAccessToken;
}

async function permanentlyDeleteGmailMessage(
  tenant: TenantInstance,
  messageId: string,
) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const accessToken = await getGmailAccessToken(tenant);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.ok || response.status === 204 || response.status === 404) {
      break; // success or already gone
    }

    const errorText = await response.text();

    // Retry on 429 rate limit with exponential backoff
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
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

    throw new Error(`Gmail permanent delete failed (${response.status}): ${errorText}`);
  }

  await tenant.gmail.db?.messages?.deleteByEntityId(messageId).catch(() => undefined);
}

/**
 * Batch-delete multiple messages in a single Gmail API call.
 * Uses POST /users/me/messages/batchDelete which is far faster than
 * N sequential DELETE requests. Includes retry for 429 rate limits.
 */
async function batchDeleteGmailMessages(
  tenant: TenantInstance,
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

    // 204 No Content = success, 404 = messages already gone
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

    throw new Error(`Gmail batch delete failed (${response.status}): ${errorText}`);
  }

  // Clean up local Corsair cache
  await Promise.all(
    messageIds.map((id) =>
      tenant.gmail.db?.messages?.deleteByEntityId(id).catch(() => undefined),
    ),
  );
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
        mailbox: z.enum(["inbox", "starred", "sent", "trash"]).default("inbox"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const labelIds = {
        inbox: ["INBOX"],
        starred: ["STARRED"],
        sent: ["SENT"],
        trash: ["TRASH"],
      }[input.mailbox];

      const result = await tenant.gmail.api.messages.list({
        maxResults: input.limit,
        labelIds,
        includeSpamTrash: input.mailbox === "trash" ? true : undefined,
        q: input.query.trim() || undefined,
      });

      const messages = result.messages ?? [];

      const mappedMessages = await Promise.all(
        messages.map(async (message) => {
          if (!message.id) return null;

          // ── 1. Try the Corsair DB cache first ─────────────────────────────
          try {
            const cached = await tenant.gmail.db.messages.findByEntityId(message.id);
            if (cached) {
              const d = cached.data as {
                subject?: string;
                from?: string;
                to?: string;
                snippet?: string;
                internalDate?: string | null;
                threadId?: string;
                labelIds?: string[];
                payload?: { headers?: Array<{ name?: string; value?: string }> };
              };

              const cacheHeaders = d.payload?.headers;
              const subject = d.subject ?? getHeader(cacheHeaders, "Subject");
              const from = d.from ?? getHeader(cacheHeaders, "From");
              const to = d.to ?? getHeader(cacheHeaders, "To");

              if (subject || from) {
                return {
                  id: cached.entity_id,
                  threadId: d.threadId ?? "",
                  snippet: d.snippet ?? "",
                  subject,
                  from,
                  to,
                  date: d.internalDate ?? null,
                  timestamp: messageTimestamp(d.internalDate ?? null),
                  labelIds: Array.isArray(d.labelIds) ? d.labelIds : [],
                };
              }
            }
          } catch {
            // cache miss or DB error — fall through to live API
          }

          // ── 2. Fall back to live Gmail API ────────────────────────────────
          // NOTE: Do NOT pass metadataHeaders here. @corsair-dev/gmail comma-joins
          // metadataHeaders (e.g. "Subject,From,To"), which Gmail API treats as a single
          // header name, causing it to return zero headers. Calling format: "metadata"
          // without metadataHeaders returns all headers without the body payload.
          try {
            const msg = await tenant.gmail.api.messages.get({
              id: message.id,
              format: "metadata",
            });

            const headers = msg.payload?.headers;
            return {
              id: msg.id ?? message.id,
              threadId: msg.threadId ?? "",
              snippet: msg.snippet ?? "",
              subject: getHeader(headers, "Subject"),
              from: getHeader(headers, "From"),
              to: getHeader(headers, "To"),
              date:
                msg.internalDate != null
                  ? String(msg.internalDate)
                  : null,
              timestamp: messageTimestamp(
                msg.internalDate != null
                  ? String(msg.internalDate)
                  : null,
              ),
              labelIds: msg.labelIds ?? [],
            };
          } catch (error) {
            const errStr = error instanceof Error ? error.message : String(error);
            // If the message was already permanently deleted (404 / Not Found), skip it
            if (
              errStr.includes("Not Found") ||
              errStr.includes("404") ||
              (typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 404)
            ) {
              return null;
            }
            // Re-throw genuine authentication, scope, or fatal API errors
            if (
              errStr.includes("insufficient") ||
              errStr.includes("401") ||
              errStr.includes("403") ||
              errStr.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")
            ) {
              throw error;
            }
            // For other transient individual message fetch errors, skip the item
            return null;
          }
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

    deleteMessages: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      await Promise.all(
        input.messageIds.map((messageId) =>
          tenant.gmail.api.messages.trash({
            id: messageId,
          }),
        ),
      );

      return {
        ids: input.messageIds,
      };
    }),


  deleteMessagePermanently: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      await permanentlyDeleteGmailMessage(tenant, input.messageId);

      return {
        id: input.messageId,
      };
    }),

  deleteMessagesPermanently: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      await batchDeleteGmailMessages(tenant, input.messageIds);

      return {
        ids: input.messageIds,
      };
    }),

  emptyTrash: protectedProcedure.mutation(async ({ ctx }) => {
    const tenant = await getTenant(ctx.session.user.id);

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
      await batchDeleteGmailMessages(tenant, messageIds);
    }

    return {
      deletedCount: messageIds.length,
    };
  }),

  restoreMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const message = await tenant.gmail.api.messages.modify({
        id: input.messageId,
        addLabelIds: ["INBOX"],
        removeLabelIds: ["TRASH"],
      });

      return {
        id: message.id ?? input.messageId,
        labelIds: message.labelIds ?? [],
      };
    }),

  restoreMessages: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const messages = await Promise.all(
        input.messageIds.map((messageId) =>
          tenant.gmail.api.messages.modify({
            id: messageId,
            addLabelIds: ["INBOX"],
            removeLabelIds: ["TRASH"],
          }),
        ),
      );

      return {
        messages: messages.map((message, index) => ({
          id: message.id ?? input.messageIds[index],
          labelIds: message.labelIds ?? [],
        })),
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

    modifyMessagesLabels: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1)).min(1).max(100),
        addLabelIds: z.array(z.string()).optional(),
        removeLabelIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenant(ctx.session.user.id);

      const messages = await Promise.all(
        input.messageIds.map((messageId) =>
          tenant.gmail.api.messages.modify({
            id: messageId,
            addLabelIds: input.addLabelIds,
            removeLabelIds: input.removeLabelIds,
          }),
        ),
      );

      return {
        messages: messages.map((message, index) => ({
          id: message.id ?? input.messageIds[index],
          labelIds: message.labelIds ?? [],
        })),
      };
    }),
});
