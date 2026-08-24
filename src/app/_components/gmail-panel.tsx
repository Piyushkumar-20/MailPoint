"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  InboxIcon,
  Loader2Icon,
  MailPlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  StickyNoteIcon,
  XIcon,
} from "lucide-react";

import { formatMessageDate, formatSender, LinkifiedText } from "@/lib/display";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

export function GmailPanel() {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [view, setView] = useState<"inbox" | "drafts">("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const utils = api.useUtils();

  const emails = api.gmail.searchEmails.useQuery(
    { query: activeSearch, limit: 50, offset: 0 },
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

  return (
    <div className="grid min-h-[calc(100svh-6rem)] gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.35fr)]">
      <section className="border-border bg-card text-card-foreground flex min-h-0 flex-col rounded-xl border">
        <div className="border-border border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Gmail
              </p>
              <h3 className="font-heading text-lg font-semibold">
                Messages and drafts
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refreshInbox.mutate()}
                disabled={refreshInbox.isPending}
              >
                <RefreshCwIcon
                  className={cn(refreshInbox.isPending && "animate-spin")}
                />
                Sync
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={connectGmail}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <ExternalLinkIcon />
                )}
                Connect
              </Button>
            </div>
          </div>

          <div className="bg-muted/45 mt-4 grid grid-cols-2 gap-2 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setView("inbox");
                setSelectedId(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                view === "inbox"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <InboxIcon className="size-4" />
              Inbox
            </button>
            <button
              type="button"
              onClick={() => {
                setView("drafts");
                setSelectedId(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                view === "drafts"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <StickyNoteIcon className="size-4" />
              Drafts
            </button>
          </div>

          {view === "inbox" && (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setActiveSearch(search);
              }}
            >
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  className="pl-8"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Gmail"
                />
              </div>
              <Button type="submit" size="icon" aria-label="Search">
                <SearchIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  setActiveSearch("");
                }}
              >
                <XIcon />
              </Button>
            </form>
          )}

          {(connectError ?? refreshInbox.error?.message) && (
            <p className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-lg border px-3 py-2 text-sm">
              {connectError ?? refreshInbox.error?.message}
            </p>
          )}

          {refreshInbox.data && (
            <p className="text-muted-foreground mt-3 text-xs">
              {refreshInbox.data.synced} messages synced from Gmail.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {view === "inbox" && emails.isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Loading messages
            </div>
          )}

          {view === "inbox" && emails.error && (
            <p className="border-destructive/30 bg-destructive/10 text-destructive m-2 rounded-lg border px-3 py-2 text-sm">
              {emails.error.message}
            </p>
          )}

          {view === "inbox" && emails.data && (
            <div className="space-y-1">
              {emails.data.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  No emails found. Sync Gmail or try a different search.
                </div>
              ) : (
                emails.data.map((email) => (
                  <button
                    key={email.id}
                    type="button"
                    className={cn(
                      "hover:border-border hover:bg-muted/50 w-full rounded-lg border border-transparent px-3 py-3 text-left transition-colors",
                      selectedId === email.id &&
                        "border-border bg-muted text-foreground",
                    )}
                    onClick={() => setSelectedId(email.id)}
                  >
                    <span className="block truncate text-sm font-medium">
                      {email.subject || email.snippet || email.id}
                    </span>
                    <span className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                      {email.from && <span>{formatSender(email.from)}</span>}
                      {email.date && (
                        <span>{formatMessageDate(email.date)}</span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {view === "drafts" && drafts.isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Loading drafts
            </div>
          )}

          {view === "drafts" && drafts.error && (
            <p className="border-destructive/30 bg-destructive/10 text-destructive m-2 rounded-lg border px-3 py-2 text-sm">
              {drafts.error.message}
            </p>
          )}

          {view === "drafts" && drafts.data && (
            <div className="space-y-2">
              {drafts.data.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  No drafts yet. Compose one on the right.
                </div>
              ) : (
                drafts.data.map((draft) => (
                  <div
                    key={draft.id}
                    className="border-border bg-background/40 flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        Draft {draft.id}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Ready to send from Gmail
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        sendDraft.mutate({
                          draftId: draft.id,
                        })
                      }
                      disabled={sendDraft.isPending}
                    >
                      {sendDraft.isPending ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <SendIcon />
                      )}
                      Send
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="min-h-[420px] rounded-xl">
          <CardHeader className="border-border border-b">
            {selectedId ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Reading pane</CardTitle>
                  <CardDescription>Message details from Gmail</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeftIcon />
                  Back
                </Button>
              </div>
            ) : (
              <>
                <CardTitle>Reading pane</CardTitle>
                <CardDescription>
                  Select a message to read without leaving the workspace.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            {!selectedId && (
              <div className="border-border flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <MailPlusIcon className="text-muted-foreground mb-3 size-8" />
                <p className="font-medium">No message selected</p>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  Search or sync Gmail, then open a message from the list.
                </p>
              </div>
            )}

            {selectedId && selectedEmail.isLoading && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                Loading message
              </div>
            )}

            {selectedId && selectedEmail.error && (
              <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                {selectedEmail.error.message}
              </p>
            )}

            {selectedId && selectedEmail.data && (
              <article className="space-y-5">
                <div>
                  <h3 className="font-heading text-2xl leading-tight font-semibold">
                    {selectedEmail.data.subject || "(no subject)"}
                  </h3>
                  <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                    <p>
                      From: {formatSender(selectedEmail.data.from)}
                      {selectedEmail.data.date && (
                        <> - {formatMessageDate(selectedEmail.data.date)}</>
                      )}
                    </p>
                    {selectedEmail.data.to && (
                      <p>To: {formatSender(selectedEmail.data.to)}</p>
                    )}
                  </div>
                </div>

                <div className="border-border bg-background/45 text-card-foreground [&_a]:text-primary rounded-lg border p-4 text-sm leading-7 whitespace-pre-wrap [&_a]:underline [&_a]:underline-offset-4">
                  <LinkifiedText
                    text={
                      selectedEmail.data.body ||
                      selectedEmail.data.snippet ||
                      "(empty)"
                    }
                  />
                </div>
              </article>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Compose</CardTitle>
            <CardDescription>Draft or send a Gmail message.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => e.preventDefault()}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="gmail-to">To</FieldLabel>
                  <Input
                    id="gmail-to"
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="name@example.com"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="gmail-subject">Subject</FieldLabel>
                  <Input
                    id="gmail-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What is this about?"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="gmail-body">Message</FieldLabel>
                  <textarea
                    id="gmail-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    placeholder="Write the message..."
                    className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-48 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                  />
                </Field>

                {(createDraft.error ?? sendEmail.error) && (
                  <Field>
                    <FieldError>
                      {(createDraft.error ?? sendEmail.error)?.message}
                    </FieldError>
                  </Field>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      createDraft.mutate({
                        to,
                        subject,
                        body,
                      })
                    }
                    disabled={createDraft.isPending || !to || !subject || !body}
                  >
                    {createDraft.isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <StickyNoteIcon />
                    )}
                    Save draft
                  </Button>

                  <Button
                    type="button"
                    onClick={() =>
                      sendEmail.mutate({
                        to,
                        subject,
                        body,
                      })
                    }
                    disabled={sendEmail.isPending || !to || !subject || !body}
                  >
                    {sendEmail.isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <SendIcon />
                    )}
                    Send
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
