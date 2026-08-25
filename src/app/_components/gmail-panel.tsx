"use client";

import { useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import {
  formatMessageDate,
  formatSender,
  LinkifiedText,
} from "@/lib/display";
import { api } from "@/trpc/react";

export function GmailPanel({
  view,
  searchQuery,
}: {
  view: "inbox" | "drafts";
  /** The active (submitted) search query, controlled by the header search box. */
  searchQuery: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const utils = api.useUtils();

  const emails = api.gmail.searchEmails.useQuery(
    { query: searchQuery, limit: 50, offset: 0 },
    { enabled: view === "inbox" },
  );

  const selectedEmail = api.gmail.getMessage.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const drafts = api.gmail.listDrafts.useQuery(
    { limit: 50, offset: 0 },
    { enabled: view === "drafts" },
  );

  const refreshInbox = api.gmail.refreshInbox.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.listDrafts.invalidate();
    },
  });

  const createDraft = api.gmail.createDraft.useMutation({
    onSuccess: async () => {
      await utils.gmail.listDrafts.invalidate();
      setTo("");
      setSubject("");
      setBody("");
    },
  });

  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      setTo("");
      setSubject("");
      setBody("");
    },
  });

  const sendDraft = api.gmail.sendDraft.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.listDrafts.invalidate();
    },
  });

  const connectGmail = async () => {
    try {
      setConnectError(null);
      setIsConnecting(true);

      const response = await fetch("/api/corsair/connect", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create Gmail connection");
      }

      const data = (await response.json()) as {
        connectUrl?: string;
      };

      if (!data.connectUrl) {
        throw new Error("Corsair did not return a connection URL");
      }

      window.location.href = data.connectUrl;
    } catch (error) {
      setIsConnecting(false);

      setConnectError(
        error instanceof Error ? error.message : "Failed to connect Gmail",
      );
    }
  };

  const toolbarButtonClass =
    "text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:hover:text-zinc-400";

  if (selectedId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-6">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {view}
        </button>

        {selectedEmail.isLoading && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}

        {selectedEmail.error && (
          <p className="text-sm text-red-400">{selectedEmail.error.message}</p>
        )}

        {selectedEmail.data && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-lg font-semibold text-zinc-100">
              {selectedEmail.data.subject || "(no subject)"}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {formatSender(selectedEmail.data.from)}
              {selectedEmail.data.date && (
                <> · {formatMessageDate(selectedEmail.data.date)}</>
              )}
            </p>

            {selectedEmail.data.to && (
              <p className="text-sm text-zinc-500">
                To: {formatSender(selectedEmail.data.to)}
              </p>
            )}

            <hr className="my-4 border-white/[0.06]" />

            <div className="whitespace-pre-wrap text-sm text-zinc-300">
              <LinkifiedText
                text={
                  selectedEmail.data.body ||
                  selectedEmail.data.snippet ||
                  "(empty)"
                }
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => refreshInbox.mutate()}
          disabled={refreshInbox.isPending}
          className={`flex items-center gap-1.5 ${toolbarButtonClass}`}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshInbox.isPending ? "animate-spin" : ""}`}
          />
          {refreshInbox.isPending ? "Refreshing…" : "Refresh from Gmail"}
        </button>

        {refreshInbox.data && (
          <span className="text-xs text-zinc-600">
            {refreshInbox.data.synced} synced
          </span>
        )}

        <span className="text-zinc-700">·</span>

        <button
          type="button"
          onClick={connectGmail}
          disabled={isConnecting}
          className={toolbarButtonClass}
        >
          {isConnecting ? "Connecting…" : "Connect Gmail"}
        </button>
      </div>

      {connectError && <p className="text-sm text-red-400">{connectError}</p>}
      {refreshInbox.error && (
        <p className="text-sm text-red-400">{refreshInbox.error.message}</p>
      )}

      {view === "inbox" && (
        <div>
          {emails.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
          {emails.error && (
            <p className="text-sm text-red-400">{emails.error.message}</p>
          )}

          {emails.data && (
            <>
              {emails.data.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] py-12 text-center">
                  <p className="text-sm text-zinc-500">
                    No emails yet. Try refreshing from Gmail.
                  </p>
                </div>
              ) : (
                <ul className="overflow-hidden rounded-lg border border-white/[0.06]">
                  {emails.data.map((email, idx) => (
                    <li
                      key={email.id}
                      className={
                        idx !== 0 ? "border-t border-white/[0.06]" : ""
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(email.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-200">
                            {email.subject || email.snippet || email.id}
                          </span>
                          {email.from && (
                            <span className="mt-0.5 block truncate text-xs text-zinc-500">
                              {formatSender(email.from)}
                            </span>
                          )}
                        </span>
                        {email.date && (
                          <span className="shrink-0 text-xs text-zinc-600">
                            {formatMessageDate(email.date)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {view === "drafts" && (
        <div>
          {drafts.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
          {drafts.error && (
            <p className="text-sm text-red-400">{drafts.error.message}</p>
          )}

          {drafts.data && (
            <>
              {drafts.data.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] py-12 text-center">
                  <p className="text-sm text-zinc-500">No drafts.</p>
                </div>
              ) : (
                <ul className="overflow-hidden rounded-lg border border-white/[0.06]">
                  {drafts.data.map((draft, idx) => (
                    <li
                      key={draft.id}
                      className={`flex items-center justify-between px-4 py-3 text-sm text-zinc-300 ${
                        idx !== 0 ? "border-t border-white/[0.06]" : ""
                      }`}
                    >
                      <span>Draft {draft.id}</span>
                      <button
                        type="button"
                        onClick={() => sendDraft.mutate({ draftId: draft.id })}
                        disabled={sendDraft.isPending}
                        className="text-xs text-[#B4A4F0] hover:text-[#C9BDF5] disabled:opacity-50"
                      >
                        Send
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-100">Compose</h2>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To"
            className="h-9 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6E56CF]/50 focus:outline-none"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-9 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6E56CF]/50 focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Message"
            className="resize-none rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6E56CF]/50 focus:outline-none"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => createDraft.mutate({ to, subject, body })}
              disabled={createDraft.isPending || !to || !subject || !body}
              className="rounded-md border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              {createDraft.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => sendEmail.mutate({ to, subject, body })}
              disabled={sendEmail.isPending || !to || !subject || !body}
              className="rounded-md bg-[#6E56CF] px-3 py-1.5 text-sm text-white hover:bg-[#7C6BDB] disabled:opacity-50"
            >
              {sendEmail.isPending ? "Sending…" : "Send"}
            </button>
          </div>

          {(createDraft.error ?? sendEmail.error) && (
            <p className="text-sm text-red-400">
              {(createDraft.error ?? sendEmail.error)?.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
