"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Forward as ForwardIcon,
  MailPlus,
  RefreshCw,
  Reply as ReplyIcon,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import DOMPurify from "dompurify";

import { formatMessageDate, formatSender, LinkifiedText } from "@/lib/display";
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
  view: "inbox" | "starred" | "drafts" | "sent";
  /** The active (submitted) search query, controlled by the header search box. */
  searchQuery: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const utils = api.useUtils();

  const mailbox =
    view === "starred" ? "starred" : view === "sent" ? "sent" : "inbox";

  const emails = api.gmail.searchEmails.useQuery(
    {
      query: searchQuery,
      limit: 50,
      offset: 0,
      mailbox,
    },
    {
      enabled: view === "inbox" || view === "starred" || view === "sent",
    },
  );

  const selectedEmail = api.gmail.getMessage.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const drafts = api.gmail.listDrafts.useQuery(
    {
      limit: 50,
      offset: 0,
    },
    {
      enabled: view === "drafts",
    },
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
      setForwardOpen(false);
    },
  });

  const replyToMessage = api.gmail.replyToMessage.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();

      setTo("");
      setSubject("");
      setBody("");
      setReplyOpen(false);
    },
  });

  const modifyMessageLabels = api.gmail.modifyMessageLabels.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
    },
  });

  const sendDraft = api.gmail.sendDraft.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.listDrafts.invalidate();
    },
  });

  /*
   * Delete normal Gmail messages.
   *
   * The UI is updated optimistically so the deleted email disappears
   * immediately instead of waiting for the Gmail API/refetch cycle.
   */
  const deleteMessage = api.gmail.deleteMessage.useMutation({
    onMutate: async ({ messageId }) => {
      /*
       * Stop an in-flight search request from overwriting our optimistic
       * update with the old list.
       */
      await utils.gmail.searchEmails.cancel();

      /*
       * Remove the message immediately from the currently visible
       * Inbox / Starred / Sent query.
       */
      utils.gmail.searchEmails.setData(
        {
          query: searchQuery,
          limit: 50,
          offset: 0,
          mailbox,
        },
        (current) => {
          if (!current) return current;

          return current.filter((email) => email.id !== messageId);
        },
      );

      /*
       * If the deleted message is currently open in the reading pane,
       * close it immediately as well.
       */
      if (selectedId === messageId) {
        setSelectedId(null);
      }
    },

    onSuccess: async () => {
      /*
       * Confirm the optimistic update against the real Gmail state.
       */
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
    },

    onError: async () => {
      /*
       * If Gmail rejects the delete, refetch the list so the removed
       * message comes back.
       */
      await utils.gmail.searchEmails.invalidate();
    },
  });

  /*
   * Delete a Gmail draft permanently.
   */
  const deleteDraft = api.gmail.deleteDraft.useMutation({
    onMutate: async ({ draftId }) => {
      await utils.gmail.listDrafts.cancel();

      utils.gmail.listDrafts.setData(
        {
          limit: 50,
          offset: 0,
        },
        (current) => {
          if (!current) return current;

          return current.filter((draft) => draft.id !== draftId);
        },
      );
    },

    onSuccess: async () => {
      await utils.gmail.listDrafts.invalidate();
    },

    onError: async () => {
      await utils.gmail.listDrafts.invalidate();
    },
  });

  const canSubmitCompose = Boolean(to && subject && body);

  const openReply = (email: { from: string; subject: string }) => {
    setTo(email.from);

    setSubject(
      email.subject.toLowerCase().startsWith("re:")
        ? email.subject
        : `Re: ${email.subject}`,
    );

    setBody("");
    setReplyOpen(true);
  };

  const openForward = (email: {
    from: string;
    to: string;
    subject: string;
    body: string;
  }) => {
    setTo("");

    setSubject(
      email.subject.toLowerCase().startsWith("fwd:")
        ? email.subject
        : `Fwd: ${email.subject}`,
    );

    const forwardedMessage = [
      "",
      "",
      "---------- Forwarded message ----------",
      `From: ${email.from}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      "",
      email.body,
    ].join("\n");

    setBody(forwardedMessage);
    setForwardOpen(true);
  };

  const isStarred = selectedEmail.data?.labelIds?.includes("STARRED") ?? false;

  const toggleStar = () => {
    if (!selectedEmail.data?.id || modifyMessageLabels.isPending) {
      return;
    }

    if (isStarred) {
      modifyMessageLabels.mutate({
        messageId: selectedEmail.data.id,
        removeLabelIds: ["STARRED"],
      });
    } else {
      modifyMessageLabels.mutate({
        messageId: selectedEmail.data.id,
        addLabelIds: ["STARRED"],
      });
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              {view === "inbox"
                ? "Inbox"
                : view === "starred"
                  ? "Starred"
                  : view === "sent"
                    ? "Sent"
                    : "Drafts"}
            </h2>

            <p className="text-muted-foreground text-xs">
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
              size="sm"
              onClick={() => setComposeOpen(true)}
            >
              <MailPlus className="h-3.5 w-3.5" />
              Compose
            </Button>
          </div>
        </div>

        {(refreshInbox.error || refreshInbox.data) && (
          <div className="border-b px-4 py-2 text-xs">
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
            {(view === "inbox" || view === "starred" || view === "sent") && (
              <MailList
                emails={emails.data}
                isLoading={emails.isLoading}
                error={emails.error?.message}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={(messageId) => deleteMessage.mutate({ messageId })}
                isDeleting={deleteMessage.isPending}
              />
            )}

            {view === "drafts" && (
              <DraftList
                drafts={drafts.data}
                isLoading={drafts.isLoading}
                error={drafts.error?.message}
                isSending={sendDraft.isPending}
                isDeleting={deleteDraft.isPending}
                onSend={(draftId) => sendDraft.mutate({ draftId })}
                onDelete={(draftId) => deleteDraft.mutate({ draftId })}
              />
            )}
          </section>

          <section
            className={cn(
              "bg-muted/20 min-h-0 overflow-y-auto",
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
              onReply={openReply}
              onForward={openForward}
              isStarred={isStarred}
              isStarPending={modifyMessageLabels.isPending}
              onToggleStar={toggleStar}
            />
          </section>
        </div>
      </div>

      {/* Compose */}
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
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-64 flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />

            {(createDraft.error ?? sendEmail.error) && (
              <p className="text-destructive text-sm">
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

      {/* Reply */}
      <Sheet open={replyOpen} onOpenChange={setReplyOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Reply</SheetTitle>
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
              placeholder="Write your reply..."
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-64 flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />

            {replyToMessage.error && (
              <p className="text-destructive text-sm">
                {replyToMessage.error.message}
              </p>
            )}
          </div>

          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={() => {
                if (!selectedEmail.data?.threadId) return;

                replyToMessage.mutate({
                  threadId: selectedEmail.data.threadId,
                  to,
                  subject,
                  body,
                });
              }}
              disabled={
                replyToMessage.isPending ||
                !to ||
                !subject ||
                !body ||
                !selectedEmail.data?.threadId
              }
            >
              <Send className="h-3.5 w-3.5" />
              {replyToMessage.isPending ? "Sending" : "Send Reply"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Forward */}
      <Sheet open={forwardOpen} onOpenChange={setForwardOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Forward</SheetTitle>
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
              placeholder="Write a message..."
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-64 flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />

            {sendEmail.error && (
              <p className="text-destructive text-sm">
                {sendEmail.error.message}
              </p>
            )}
          </div>

          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={() => {
                sendEmail.mutate({
                  to,
                  subject,
                  body,
                });
              }}
              disabled={sendEmail.isPending || !to || !subject || !body}
            >
              <Send className="h-3.5 w-3.5" />
              {sendEmail.isPending ? "Sending" : "Forward"}
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
  onDelete,
  isDeleting,
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
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  if (isLoading) {
    return <StatusLine>Loading mail...</StatusLine>;
  }

  if (error) {
    return <StatusLine tone="error">{error}</StatusLine>;
  }

  if (!emails || emails.length === 0) {
    return (
      <EmptyPanel
        title="No emails yet"
        description="Try refreshing from Gmail."
      />
    );
  }

  return (
    <ul>
      {emails.map((email) => (
        <li key={email.id} className="border-b">
          <div
            className={cn(
              "hover:bg-muted/60 grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-l-2 border-l-transparent px-4 py-3 transition-colors",
              selectedId === email.id &&
                "border-l-primary bg-primary/10 hover:bg-primary/15",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(email.id)}
              className="min-w-0 text-left"
            >
              <span className="block truncate text-sm font-semibold">
                {email.from ? formatSender(email.from) : "Unknown sender"}
              </span>

              <span className="mt-0.5 block truncate text-sm font-medium">
                {email.subject || "(no subject)"}
              </span>

              {email.snippet && (
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  {email.snippet}
                </span>
              )}
            </button>

            <div className="flex shrink-0 items-start gap-2">
              {email.date && (
                <span className="text-muted-foreground pt-0.5 text-xs">
                  {formatMessageDate(email.date)}
                </span>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                aria-label="Delete email"
                title="Delete email"
                onClick={(event) => {
                  event.stopPropagation();

                  const confirmed = window.confirm("Move this email to Trash?");

                  if (!confirmed) return;

                  onDelete(email.id);
                }}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
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
  isDeleting,
  onSend,
  onDelete,
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
  isDeleting: boolean;
  onSend: (draftId: string) => void;
  onDelete: (draftId: string) => void;
}) {
  if (isLoading) {
    return <StatusLine>Loading drafts...</StatusLine>;
  }

  if (error) {
    return <StatusLine tone="error">{error}</StatusLine>;
  }

  if (!drafts || drafts.length === 0) {
    return (
      <EmptyPanel
        title="No drafts"
        description="Saved drafts will appear here."
      />
    );
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
              <p className="text-muted-foreground text-xs">
                Saved {formatMessageDate(draft.createdAt)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSend(draft.id)}
              disabled={isSending || isDeleting}
            >
              {isSending ? "Sending" : "Send"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-8 w-8"
              aria-label="Delete draft"
              title="Delete draft"
              onClick={() => {
                const confirmed = window.confirm(
                  "Delete this draft permanently?",
                );

                if (!confirmed) return;

                onDelete(draft.id);
              }}
              disabled={isSending || isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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
  onReply,
  onForward,
  isStarred,
  isStarPending,
  onToggleStar,
}: {
  selectedId: string | null;
  selectedEmail:
    | {
        id: string;
        threadId: string;
        subject: string;
        from: string;
        to: string;
        body: string;
        bodyMimeType: "text/plain" | "text/html";
        snippet: string;
        date: string | null;
        labelIds: string[];
      }
    | undefined;
  isLoading: boolean;
  error?: string;
  onBack: () => void;
  view: "inbox" | "starred" | "drafts" | "sent";
  onReply: (email: { from: string; subject: string }) => void;
  onForward: (email: {
    from: string;
    to: string;
    subject: string;
    body: string;
  }) => void;
  isStarred: boolean;
  isStarPending: boolean;
  onToggleStar: () => void;
}) {
  if (!selectedId) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div>
          <p className="font-heading text-sm font-semibold">Select a message</p>

          <p className="text-muted-foreground mt-1 text-sm">
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
        <div className="bg-card text-card-foreground border-border/80 rounded-lg border p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading min-w-0 text-xl leading-tight font-semibold">
              {selectedEmail.subject || "(no subject)"}
            </h2>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleStar}
              disabled={isStarPending}
              aria-label={isStarred ? "Unstar email" : "Star email"}
              title={isStarred ? "Unstar" : "Star"}
              className="shrink-0"
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  isStarred && "fill-primary text-primary",
                )}
              />
            </Button>
          </div>

          <div className="text-muted-foreground mt-4 space-y-1 text-sm">
            <p>
              <span>From </span>

              <span className="text-foreground font-medium">
                {formatSender(selectedEmail.from)}
              </span>
            </p>

            {selectedEmail.to && (
              <p>
                <span>To </span>
                {formatSender(selectedEmail.to)}
              </p>
            )}

            {selectedEmail.date && (
              <p>{formatMessageDate(selectedEmail.date)}</p>
            )}
          </div>

          <div className="mt-5 border-t pt-5">
            <EmailBody
              body={selectedEmail.body || selectedEmail.snippet || "(empty)"}
              bodyMimeType={selectedEmail.bodyMimeType}
            />
          </div>

          <div className="mt-5 flex items-center gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onReply(selectedEmail)}
            >
              <ReplyIcon className="h-3.5 w-3.5" />
              Reply
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onForward(selectedEmail)}
            >
              <ForwardIcon className="h-3.5 w-3.5" />
              Forward
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function EmailBody({
  body,
  bodyMimeType,
}: {
  body: string;
  bodyMimeType: "text/plain" | "text/html";
}) {
  const sanitizedHtml = useMemo(
    () =>
      bodyMimeType === "text/html"
        ? DOMPurify.sanitize(body, {
            ALLOWED_TAGS: [
              "a",
              "b",
              "blockquote",
              "br",
              "caption",
              "code",
              "div",
              "em",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "hr",
              "i",
              "li",
              "ol",
              "p",
              "pre",
              "span",
              "strong",
              "sub",
              "sup",
              "table",
              "tbody",
              "td",
              "tfoot",
              "th",
              "thead",
              "tr",
              "u",
              "ul",
            ],
            ALLOWED_ATTR: [
              "align",
              "border",
              "cellpadding",
              "cellspacing",
              "cite",
              "colspan",
              "href",
              "name",
              "rowspan",
              "title",
              "valign",
              "width",
            ],
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/(?!\/))/i,
            FORBID_TAGS: [
              "base",
              "embed",
              "form",
              "iframe",
              "img",
              "input",
              "link",
              "meta",
              "object",
              "script",
              "style",
            ],
            FORBID_ATTR: ["src", "srcset", "style", "onerror", "onclick"],
          })
        : "",
    [body, bodyMimeType],
  );

  if (bodyMimeType === "text/html" && sanitizedHtml) {
    return (
      <div
        className="email-html-body [&_a]:text-primary [&_blockquote]:border-primary/40 [&_pre]:bg-muted [&_td]:border-border [&_th]:border-border [&_th]:bg-muted/60 overflow-x-auto text-sm leading-6 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <div className="[&_a]:text-primary text-sm leading-6 whitespace-pre-wrap [&_a]:underline [&_a]:underline-offset-2">
      <LinkifiedText text={body} />
    </div>
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
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </div>
  );
}
