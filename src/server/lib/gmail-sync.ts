import { and, eq, inArray } from "drizzle-orm";

import { db as appDb } from "@/server/db";
import { gmailMessages, gmailSyncState } from "@/server/db/schema";
import {
  extractBodyFromPayload,
  getHeader,
  looksLikeHtml,
} from "@/server/lib/email";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Db = typeof appDb;

/** Minimal shape of what Corsair's withTenant() returns for Gmail. */
type TenantGmail = {
  gmail: {
    keys: {
      get_access_token: () => Promise<string | null>;
      get_expires_at: () => Promise<string | null>;
      get_refresh_token: () => Promise<string | null>;
      set_access_token: (v: string) => Promise<void>;
      set_expires_at: (v: string) => Promise<void>;
      get_integration_credentials: () => Promise<{
        client_id?: string;
        client_secret?: string;
      }>;
    };
    api: {
      messages: {
        list: (params: {
          maxResults?: number;
          labelIds?: string[];
          includeSpamTrash?: boolean;
          pageToken?: string;
          q?: string;
        }) => Promise<{
          messages?: Array<{ id?: string; threadId?: string }>;
          nextPageToken?: string;
          resultSizeEstimate?: number;
        }>;
        get: (params: {
          id: string;
          format?: string;
        }) => Promise<{
          id?: string;
          threadId?: string;
          historyId?: string;
          snippet?: string;
          internalDate?: string | number;
          labelIds?: string[];
          payload?: {
            headers?: Array<{ name?: string; value?: string }>;
            mimeType?: string;
            body?: { data?: string };
            parts?: unknown[];
          };
        }>;
        modify: (params: {
          id: string;
          addLabelIds?: string[];
          removeLabelIds?: string[];
        }) => Promise<{
          id?: string;
          labelIds?: string[];
        }>;
      };
    };
    /** Exists if Corsair has a local entity cache — may be undefined. */
    db?: unknown;
  };
};

export type SyncStatus =
  | "initial_sync_required"
  | "syncing"
  | "synced"
  | "sync_error"
  | "full_sync_required";

export type SyncState = {
  id: string;
  tenantId: string;
  historyId: string | null;
  status: SyncStatus;
  lastSyncedAt: Date | null;
  lastError: string | null;
  initialSyncCompletedAt: Date | null;
};

// ---------------------------------------------------------------------------
// Internal Gmail access-token refresh (mirrors gmail.ts, kept DRY here)
// ---------------------------------------------------------------------------

async function getAccessToken(tenant: TenantGmail): Promise<string> {
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
  const newExpiresAt = now + data.expires_in;

  await Promise.all([
    tenant.gmail.keys.set_access_token(data.access_token),
    tenant.gmail.keys.set_expires_at(String(newExpiresAt)),
  ]);

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Bounded-concurrency fetch helper
// ---------------------------------------------------------------------------

async function fetchMessagesBounded(
  tenant: TenantGmail,
  ids: string[],
  concurrency = 5,
): Promise<
  Array<{
    id?: string;
    threadId?: string;
    historyId?: string;
    snippet?: string;
    internalDate?: string | number;
    labelIds?: string[];
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    };
  }>
> {
  const results: Awaited<
    ReturnType<TenantGmail["gmail"]["api"]["messages"]["get"]>
  >[] = [];

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((id) =>
        retryWithBackoff(() =>
          tenant.gmail.api.messages.get({ id, format: "metadata" }),
        ),
      ),
    );
    results.push(...batchResults);
  }

  return results;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("rate"));
      const isTransient =
        isRateLimit ||
        (err instanceof Error && /5[0-9]{2}/.test(err.message));

      if (isTransient && attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  // Unreachable but satisfies TypeScript
  throw new Error("retryWithBackoff: exceeded max retries");
}

// ---------------------------------------------------------------------------
// Label flag extraction
// ---------------------------------------------------------------------------

export function extractLabelFlags(labelIds: string[]): {
  isUnread: boolean;
  isStarred: boolean;
  isInbox: boolean;
  isSent: boolean;
  isTrash: boolean;
  isDraft: boolean;
} {
  const set = new Set(labelIds);
  return {
    isUnread: set.has("UNREAD"),
    isStarred: set.has("STARRED"),
    isInbox: set.has("INBOX"),
    isSent: set.has("SENT"),
    isTrash: set.has("TRASH"),
    isDraft: set.has("DRAFT"),
  };
}

// ---------------------------------------------------------------------------
// Sync state helpers
// ---------------------------------------------------------------------------

export async function getOrInitSyncState(
  tenantId: string,
  db: Db = appDb,
): Promise<SyncState> {
  const existing = await db.query.gmailSyncState.findFirst({
    where: eq(gmailSyncState.tenantId, tenantId),
  });

  if (existing) {
    return {
      id: existing.id,
      tenantId: existing.tenantId,
      historyId: existing.historyId ?? null,
      status: existing.status,
      lastSyncedAt: existing.lastSyncedAt ?? null,
      lastError: existing.lastError ?? null,
      initialSyncCompletedAt: existing.initialSyncCompletedAt ?? null,
    };
  }

  const id = crypto.randomUUID();
  await db.insert(gmailSyncState).values({
    id,
    tenantId,
    status: "initial_sync_required",
    historyId: null,
    lastSyncedAt: null,
    lastError: null,
    initialSyncCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    id,
    tenantId,
    historyId: null,
    status: "initial_sync_required",
    lastSyncedAt: null,
    lastError: null,
    initialSyncCompletedAt: null,
  };
}

async function updateSyncState(
  tenantId: string,
  patch: Partial<{
    status: SyncStatus;
    historyId: string | null;
    lastSyncedAt: Date;
    lastError: string | null;
    initialSyncCompletedAt: Date | null;
  }>,
  db: Db = appDb,
) {
  await db
    .update(gmailSyncState)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(gmailSyncState.tenantId, tenantId));
}

// ---------------------------------------------------------------------------
// Upsert single Gmail message into the local index
// ---------------------------------------------------------------------------

type RawGmailMessage = Awaited<
  ReturnType<TenantGmail["gmail"]["api"]["messages"]["get"]>
>;

export async function upsertGmailMessage(
  tenantId: string,
  msg: RawGmailMessage,
  db: Db = appDb,
): Promise<void> {
  if (!msg.id) return;

  const headers = msg.payload?.headers ?? [];
  const labelIds = msg.labelIds ?? [];
  const flags = extractLabelFlags(labelIds);
  const now = new Date();

  await db
    .insert(gmailMessages)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      messageId: msg.id,
      threadId: msg.threadId ?? "",
      historyId: msg.historyId ? String(msg.historyId) : null,
      fromAddress: getHeader(headers, "From"),
      toAddress: getHeader(headers, "To"),
      ccAddress: getHeader(headers, "Cc"),
      subject: getHeader(headers, "Subject"),
      snippet: msg.snippet ?? "",
      internalDate:
        msg.internalDate != null ? String(msg.internalDate) : null,
      labelIds,
      ...flags,
      bodyStored: false,
      body: null,
      bodyMimeType: null,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [gmailMessages.tenantId, gmailMessages.messageId],
      set: {
        threadId: msg.threadId ?? "",
        historyId: msg.historyId ? String(msg.historyId) : null,
        fromAddress: getHeader(headers, "From"),
        toAddress: getHeader(headers, "To"),
        ccAddress: getHeader(headers, "Cc"),
        subject: getHeader(headers, "Subject"),
        snippet: msg.snippet ?? "",
        internalDate:
          msg.internalDate != null ? String(msg.internalDate) : null,
        labelIds,
        ...flags,
        syncedAt: now,
        updatedAt: now,
        // Note: bodyStored / body / bodyMimeType are NOT reset here —
        // once a body is cached it stays cached.
      },
    });
}

/**
 * Fast local-only label update — used after Gmail mutations (mark read,
 * star, archive, trash, restore) so the UI reflects the change immediately
 * without waiting for the next sync cycle.
 */
export async function updateMessageLabels(
  tenantId: string,
  messageId: string,
  newLabelIds: string[],
  db: Db = appDb,
): Promise<void> {
  const flags = extractLabelFlags(newLabelIds);
  await db
    .update(gmailMessages)
    .set({ labelIds: newLabelIds, ...flags, updatedAt: new Date() })
    .where(
      and(
        eq(gmailMessages.tenantId, tenantId),
        eq(gmailMessages.messageId, messageId),
      ),
    );
}

/**
 * Remove a message from the local index (used after permanent delete or
 * when incremental sync reports messagesDeleted).
 */
export async function deleteLocalMessage(
  tenantId: string,
  messageId: string,
  db: Db = appDb,
): Promise<void> {
  await db
    .delete(gmailMessages)
    .where(
      and(
        eq(gmailMessages.tenantId, tenantId),
        eq(gmailMessages.messageId, messageId),
      ),
    );
}

/**
 * Remove multiple messages from the local index.
 */
export async function deleteLocalMessages(
  tenantId: string,
  messageIds: string[],
  db: Db = appDb,
): Promise<void> {
  if (messageIds.length === 0) return;
  await db
    .delete(gmailMessages)
    .where(
      and(
        eq(gmailMessages.tenantId, tenantId),
        inArray(gmailMessages.messageId, messageIds),
      ),
    );
}

// ---------------------------------------------------------------------------
// Full synchronisation
// ---------------------------------------------------------------------------

const FULL_SYNC_PAGE_SIZE = 50; // conservative; Google recommends ≤500
const MAX_FULL_SYNC_MESSAGES = 500; // cap to avoid very long initial syncs

export async function performFullSync(
  tenantId: string,
  tenant: TenantGmail,
  db: Db = appDb,
): Promise<void> {
  const syncStart = Date.now();
  console.log(`[GmailSync] Starting full sync for tenant ${tenantId}`);

  await updateSyncState(tenantId, { status: "syncing", lastError: null }, db);

  try {
    let latestHistoryId: string | null = null;
    let totalFetched = 0;
    let pageToken: string | undefined;
    let isFirstPage = true;

    do {
      const listResult = await retryWithBackoff(() =>
        tenant.gmail.api.messages.list({
          maxResults: FULL_SYNC_PAGE_SIZE,
          // Fetch all major labels in one list call via INBOX filter
          // (Gmail returns all INBOX messages; we also run separate passes
          // for SENT, STARRED, TRASH further below on first run)
          labelIds: isFirstPage ? undefined : undefined,
          includeSpamTrash: true,
          pageToken,
        }),
      );

      const msgStubs = listResult.messages ?? [];
      const ids = msgStubs
        .map((m) => m.id)
        .filter((id): id is string => Boolean(id));

      if (ids.length > 0) {
        // Fetch metadata in bounded batches (5 concurrent)
        const fetched = await fetchMessagesBounded(tenant, ids, 5);

        for (const msg of fetched) {
          if (!msg.id) continue;
          await upsertGmailMessage(tenantId, msg, db);

          if (msg.historyId) {
            const h = String(msg.historyId);
            if (!latestHistoryId || BigInt(h) > BigInt(latestHistoryId)) {
              latestHistoryId = h;
            }
          }
        }

        totalFetched += fetched.length;
        console.log(
          `[GmailSync] Full sync progress: ${totalFetched} messages upserted`,
        );
      }

      pageToken = listResult.nextPageToken ?? undefined;
      isFirstPage = false;

      // After first page (50 messages) the UI is immediately usable.
      // We continue fetching up to MAX_FULL_SYNC_MESSAGES in the background.
      if (totalFetched >= MAX_FULL_SYNC_MESSAGES) {
        console.log(
          `[GmailSync] Full sync cap reached (${MAX_FULL_SYNC_MESSAGES}). Stopping.`,
        );
        break;
      }
    } while (pageToken);

    const now = new Date();
    await updateSyncState(
      tenantId,
      {
        status: "synced",
        historyId: latestHistoryId,
        lastSyncedAt: now,
        lastError: null,
        initialSyncCompletedAt: now,
      },
      db,
    );

    console.log(
      `[GmailSync] Full sync complete for tenant ${tenantId}: ` +
        `${totalFetched} messages in ${Date.now() - syncStart}ms`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[GmailSync] Full sync error for tenant ${tenantId}:`, err);
    await updateSyncState(
      tenantId,
      { status: "sync_error", lastError: errorMsg },
      db,
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Incremental synchronisation (history.list)
// ---------------------------------------------------------------------------

type HistoryRecord = {
  id?: string;
  messagesAdded?: Array<{ message?: { id?: string; threadId?: string; labelIds?: string[] } }>;
  messagesDeleted?: Array<{ message?: { id?: string } }>;
  labelsAdded?: Array<{ message?: { id?: string; labelIds?: string[] } }>;
  labelsRemoved?: Array<{ message?: { id?: string; labelIds?: string[] } }>;
};

type HistoryListResponse = {
  history?: HistoryRecord[];
  nextPageToken?: string;
  historyId?: string;
};

export async function performIncrementalSync(
  tenantId: string,
  tenant: TenantGmail,
  db: Db = appDb,
): Promise<void> {
  const syncStart = Date.now();
  const syncState = await getOrInitSyncState(tenantId, db);

  if (!syncState.historyId) {
    console.log(
      `[GmailSync] No historyId for tenant ${tenantId}, triggering full sync`,
    );
    await performFullSync(tenantId, tenant, db);
    return;
  }

  console.log(
    `[GmailSync] Starting incremental sync from historyId=${syncState.historyId}`,
  );
  await updateSyncState(tenantId, { status: "syncing", lastError: null }, db);

  try {
    const accessToken = await getAccessToken(tenant);
    let pageToken: string | undefined;
    let latestHistoryId = syncState.historyId;
    let changesProcessed = 0;

    const addedIds = new Set<string>();
    const deletedIds = new Set<string>();
    const labelChangedIds = new Set<string>();
    const labelChangedMap = new Map<string, string[]>();

    do {
      const url = new URL(
        "https://gmail.googleapis.com/gmail/v1/users/me/history",
      );
      url.searchParams.set("startHistoryId", syncState.historyId);
      url.searchParams.set("maxResults", "100");
      url.searchParams.set("historyTypes", "messageAdded");
      url.searchParams.append("historyTypes", "messageDeleted");
      url.searchParams.append("historyTypes", "labelAdded");
      url.searchParams.append("historyTypes", "labelRemoved");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await retryWithBackoff(() =>
        fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then(async (res) => {
          if (res.status === 404) {
            // historyId is too old — fall back to full sync
            throw Object.assign(new Error("historyId_expired"), {
              gmailHistoryExpired: true,
            });
          }
          if (!res.ok) {
            throw new Error(
              `Gmail history.list failed (${res.status}): ${await res.text()}`,
            );
          }
          return res.json() as Promise<HistoryListResponse>;
        }),
      );

      const histories = response.history ?? [];

      for (const record of histories) {
        for (const added of record.messagesAdded ?? []) {
          if (added.message?.id) addedIds.add(added.message.id);
        }
        for (const deleted of record.messagesDeleted ?? []) {
          if (deleted.message?.id) deletedIds.add(deleted.message.id);
        }
        for (const la of record.labelsAdded ?? []) {
          if (la.message?.id && la.message.labelIds) {
            labelChangedIds.add(la.message.id);
            labelChangedMap.set(la.message.id, la.message.labelIds);
          }
        }
        for (const lr of record.labelsRemoved ?? []) {
          if (lr.message?.id && lr.message.labelIds) {
            labelChangedIds.add(lr.message.id);
            labelChangedMap.set(lr.message.id, lr.message.labelIds);
          }
        }
        if (record.id) {
          if (!latestHistoryId || BigInt(record.id) > BigInt(latestHistoryId)) {
            latestHistoryId = record.id;
          }
        }
      }

      changesProcessed += histories.length;
      pageToken = response.nextPageToken ?? undefined;
      if (response.historyId) {
        latestHistoryId = response.historyId;
      }
    } while (pageToken);

    // Process deletions first
    const toDelete = Array.from(deletedIds);
    if (toDelete.length > 0) {
      await deleteLocalMessages(tenantId, toDelete, db);
      console.log(
        `[GmailSync] Deleted ${toDelete.length} messages from index`,
      );
    }

    // Fetch metadata for newly added messages
    const toFetch = Array.from(addedIds).filter((id) => !deletedIds.has(id));
    if (toFetch.length > 0) {
      const fetched = await fetchMessagesBounded(tenant, toFetch, 5);
      for (const msg of fetched) {
        if (!msg.id) continue;
        await upsertGmailMessage(tenantId, msg, db);
        if (msg.historyId && BigInt(msg.historyId) > BigInt(latestHistoryId ?? "0")) {
          latestHistoryId = String(msg.historyId);
        }
      }
      console.log(
        `[GmailSync] Upserted ${fetched.length} new messages into index`,
      );
    }

    // Re-fetch label-changed messages that weren't also added/deleted
    const toRefetchForLabels = Array.from(labelChangedIds).filter(
      (id) => !addedIds.has(id) && !deletedIds.has(id),
    );
    if (toRefetchForLabels.length > 0) {
      const fetched = await fetchMessagesBounded(tenant, toRefetchForLabels, 5);
      for (const msg of fetched) {
        if (!msg.id) continue;
        await upsertGmailMessage(tenantId, msg, db);
      }
      console.log(
        `[GmailSync] Updated labels for ${fetched.length} messages`,
      );
    }

    await updateSyncState(
      tenantId,
      {
        status: "synced",
        historyId: latestHistoryId,
        lastSyncedAt: new Date(),
        lastError: null,
      },
      db,
    );

    console.log(
      `[GmailSync] Incremental sync complete for tenant ${tenantId}: ` +
        `${changesProcessed} history records in ${Date.now() - syncStart}ms`,
    );
  } catch (err) {
    const isExpired =
      typeof err === "object" &&
      err !== null &&
      "gmailHistoryExpired" in err;

    if (isExpired) {
      console.warn(
        `[GmailSync] historyId expired for tenant ${tenantId}, triggering full sync`,
      );
      await updateSyncState(
        tenantId,
        { status: "full_sync_required", lastError: "historyId expired" },
        db,
      );
      await performFullSync(tenantId, tenant, db);
      return;
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[GmailSync] Incremental sync error for tenant ${tenantId}:`,
      err,
    );
    await updateSyncState(
      tenantId,
      { status: "sync_error", lastError: errorMsg },
      db,
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Body cache — used by getMessage after fetching from Gmail
// ---------------------------------------------------------------------------

export async function cacheMessageBody(
  tenantId: string,
  messageId: string,
  body: string,
  bodyMimeType: "text/plain" | "text/html",
  db: Db = appDb,
): Promise<void> {
  await db
    .update(gmailMessages)
    .set({
      bodyStored: true,
      body,
      bodyMimeType,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gmailMessages.tenantId, tenantId),
        eq(gmailMessages.messageId, messageId),
      ),
    );
}

// ---------------------------------------------------------------------------
// triggerBackgroundSync — public entry point
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget sync trigger.
 *
 * Decides whether to run a full or incremental sync based on the current
 * sync state. Safe to call from a tRPC mutation — it does NOT await the
 * sync operation itself, so the HTTP request returns immediately.
 *
 * The actual sync runs in the background. Errors are logged and stored in
 * gmail_sync_state.last_error; they do not propagate to the caller.
 *
 * This design means the function can later be called from:
 *   - A Vercel cron endpoint
 *   - A Gmail Pub/Sub push webhook
 *   - A BullMQ / pg-boss background worker
 * …without any changes to the caller interface.
 */
const activeSyncs = new Set<string>();

export function triggerBackgroundSync(
  tenantId: string,
  tenant: TenantGmail,
  db: Db = appDb,
): void {
  if (activeSyncs.has(tenantId)) {
    console.log(
      `[GmailSync] Sync already active in-memory for tenant ${tenantId}, skipping`,
    );
    return;
  }
  activeSyncs.add(tenantId);

  void (async () => {
    try {
      const state = await getOrInitSyncState(tenantId, db);

      // Don't pile up concurrent syncs
      if (state.status === "syncing") {
        console.log(
          `[GmailSync] Sync already in progress for tenant ${tenantId}, skipping`,
        );
        return;
      }

      if (
        state.status === "initial_sync_required" ||
        state.status === "full_sync_required"
      ) {
        await performFullSync(tenantId, tenant, db);
      } else {
        // synced or sync_error — attempt incremental, fall back to full on error
        try {
          await performIncrementalSync(tenantId, tenant, db);
        } catch {
          // incremental already handles its own full-sync fallback for
          // expired historyId; other errors are already stored in state.
        }
      }
    } catch (err) {
      console.error(
        `[GmailSync] triggerBackgroundSync uncaught error for tenant ${tenantId}:`,
        err,
      );
    } finally {
      activeSyncs.delete(tenantId);
    }
  })();
}

// ---------------------------------------------------------------------------
// Re-export extractBodyFromPayload / looksLikeHtml for use in gmail.ts
// (avoids duplicating the import chain)
// ---------------------------------------------------------------------------
export { extractBodyFromPayload, looksLikeHtml };
