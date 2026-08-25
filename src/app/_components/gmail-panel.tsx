"use client";

import { useState } from "react";
import { ArrowLeft, MailPlus, RefreshCw, Send } from "lucide-react";

import {
  formatMessageDate,
  formatSender,
  LinkifiedText,
} from "@/lib/display";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function GmailPanel({
  view,
  searchQuery,
}: {
  view: "inbox" | "drafts";
  /** The active (submitted) search query, controlled by the header search box. */
  searchQuery: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

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
      setComposeOpen(false);
    },
  });

  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      setTo("");
      setSubject("");
      setBody("");
      setComposeOpen(false);
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

  const canSubmitCompose = Boolean(to && subject && body);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              {view === "inbox" ? "Inbox" : "Drafts"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? `Results for "${searchQuery}"` : "Mail from Gmail"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refreshInbox.mutate()}
              disabled={refreshInbox.isPending}
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  refreshInbox.isPending && "animate-spin",
                )}
              />
              <span className="hidden sm:inline">
                {refreshInbox.isPending ? "Refreshing" : "Refresh"}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={connectGmail}
              disabled={isConnecting}
              className="text-muted-foreground"
            >
              {isConnecting ? "Connecting" : "Connect Gmail"}
            </Button>
            <Button type="button" size="sm" onClick={() => setComposeOpen(true)}>
              <MailPlus className="h-3.5 w-3.5" />
              Compose
            </Button>
          </div>
        </div>

        {(connectError || refreshInbox.error || refreshInbox.data) && (
          <div className="border-b px-4 py-2 text-xs">
            {connectError && <p className="text-destructive">{connectError}</p>}
            {refreshInbox.error && (
              <p className="text-destructive">{refreshInbox.error.message}</p>
            )}
            {refreshInbox.data && (
              <p className="text-muted-foreground">
                {refreshInbox.data.synced} synced from Google
              </p>
            )}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(320px,42%)_1fr]">
          <section
            className={cn(
              "min-h-0 overflow-y-auto border-r",
              selectedId && "hidden lg:block",
            )}
          >
            {view === "inbox" && (
              <MailList
                emails={emails.data}
                isLoading={emails.isLoading}
                error={emails.error?.message}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            {view === "drafts" && (
              <DraftList
                drafts={drafts.data}
                isLoading={drafts.isLoading}
                error={drafts.error?.message}
                isSending={sendDraft.isPending}
                onSend={(draftId) => sendDraft.mutate({ draftId })}
              />
            )}
          </section>

          <section
            className={cn(
              "min-h-0 overflow-y-auto bg-muted/20",
              !selectedId && "hidden lg:block",
            )}
          >
            <ReadingPane
              selectedId={selectedId}
              selectedEmail={selectedEmail.data}
              isLoading={selectedEmail.isLoading}
              error={selectedEmail.error?.message}
              onBack={() => setSelectedId(null)}
              view={view}
            />
          </section>
        </div>
      </div>

      <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>New message</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-3 px-4">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="To"
            />
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message"
              className="min-h-64 flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />

            {(createDraft.error ?? sendEmail.error) && (
              <p className="text-sm text-destructive">
                {(createDraft.error ?? sendEmail.error)?.message}
              </p>
            )}
          </div>

          <SheetFooter className="border-t sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => createDraft.mutate({ to, subject, body })}
              disabled={createDraft.isPending || !canSubmitCompose}
            >
              {createDraft.isPending ? "Saving" : "Save draft"}
            </Button>
            <Button
              type="button"
              onClick={() => sendEmail.mutate({ to, subject, body })}
              disabled={sendEmail.isPending || !canSubmitCompose}
            >
              <Send className="h-3.5 w-3.5" />
              {sendEmail.isPending ? "Sending" : "Send"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MailList({
  emails,
  isLoading,
  error,
  selectedId,
  onSelect,
}: {
  emails:
    | {
        id: string;
        subject: string;
        snippet: string;
        from: string;
        date: string | null;
      }[]
    | undefined;
  isLoading: boolean;
  error?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (isLoading) return <StatusLine>Loading mail...</StatusLine>;
  if (error) return <StatusLine tone="error">{error}</StatusLine>;

  if (!emails || emails.length === 0) {
    return (
      <EmptyPanel title="No emails yet" description="Try refreshing from Gmail." />
    );
  }

  return (
    <ul>
      {emails.map((email) => (
        <li key={email.id} className="border-b">
          <button
            type="button"
            onClick={() => onSelect(email.id)}
            className={cn(
              "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
              selectedId === email.id && "bg-accent",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {email.from ? formatSender(email.from) : "Unknown sender"}
              </span>
              <span className="mt-0.5 block truncate text-sm font-medium">
                {email.subject || "(no subject)"}
              </span>
              {email.snippet && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {email.snippet}
                </span>
              )}
            </span>
            {email.date && (
              <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                {formatMessageDate(email.date)}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DraftList({
  drafts,
  isLoading,
  error,
  isSending,
  onSend,
}: {
  drafts:
    | {
        id: string;
        messageId: string;
        createdAt: Date | null;
      }[]
    | undefined;
  isLoading: boolean;
  error?: string;
  isSending: boolean;
  onSend: (draftId: string) => void;
}) {
  if (isLoading) return <StatusLine>Loading drafts...</StatusLine>;
  if (error) return <StatusLine tone="error">{error}</StatusLine>;

  if (!drafts || drafts.length === 0) {
    return <EmptyPanel title="No drafts" description="Saved drafts will appear here." />;
  }

  return (
    <ul>
      {drafts.map((draft) => (
        <li
          key={draft.id}
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Draft {draft.id}</p>
            {draft.createdAt && (
              <p className="text-xs text-muted-foreground">
                Saved {formatMessageDate(draft.createdAt)}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSend(draft.id)}
            disabled={isSending}
          >
            Send
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ReadingPane({
  selectedId,
  selectedEmail,
  isLoading,
  error,
  onBack,
  view,
}: {
  selectedId: string | null;
  selectedEmail:
    | {
        subject: string;
        from: string;
        to: string;
        body: string;
        snippet: string;
        date: string | null;
      }
    | undefined;
  isLoading: boolean;
  error?: string;
  onBack: () => void;
  view: "inbox" | "drafts";
}) {
  if (!selectedId) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div>
          <p className="font-heading text-sm font-semibold">Select a message</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your reading pane keeps the conversation in context.
          </p>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-5 py-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 lg:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {view}
      </Button>

      {isLoading && <StatusLine>Loading message...</StatusLine>}
      {error && <StatusLine tone="error">{error}</StatusLine>}

      {selectedEmail && (
        <div className="rounded-lg border bg-card p-5 text-card-foreground">
          <h2 className="font-heading text-xl font-semibold leading-tight">
            {selectedEmail.subject || "(no subject)"}
          </h2>

          <div className="mt-4 space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">From </span>
              <span className="font-medium">{formatSender(selectedEmail.from)}</span>
            </p>
            {selectedEmail.to && (
              <p>
                <span className="text-muted-foreground">To </span>
                {formatSender(selectedEmail.to)}
              </p>
            )}
            {selectedEmail.date && (
              <p className="text-muted-foreground">
                {formatMessageDate(selectedEmail.date)}
              </p>
            )}
          </div>

          <div className="mt-5 border-t pt-5">
            <div className="whitespace-pre-wrap text-sm leading-6">
              <LinkifiedText
                text={selectedEmail.body || selectedEmail.snippet || "(empty)"}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function StatusLine({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={cn(
        "px-4 py-4 text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="m-4 rounded-lg border border-dashed py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
