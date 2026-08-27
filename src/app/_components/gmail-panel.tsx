"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  Eraser,
  Italic,
  Link,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Paperclip,
  Quote,
  Forward as ForwardIcon,
  Image as ImageIcon,
  MailPlus,
  RefreshCw,
  Reply as ReplyIcon,
  Send,
  Smile,
  Star,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import DOMPurify from "dompurify";

import { formatMessageDate, formatSender, LinkifiedText } from "@/lib/display";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ComposerMode = "compose" | "reply" | "forward";

export function GmailPanel({
  view,
  searchQuery,
}: {
  view: "inbox" | "starred" | "drafts" | "sent";
  /** The active (submitted) search query, controlled by the header search box. */
  searchQuery: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [composerMinimized, setComposerMinimized] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
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
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      closeComposer();
    },
  });

  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();

      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");

      closeComposer();
    },
  });

  const replyToMessage = api.gmail.replyToMessage.useMutation({
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();

      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      closeComposer();
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

  const openComposer = (mode: ComposerMode) => {
    setComposerMode(mode);
    setComposerMinimized(false);
  };

  const closeComposer = () => {
    setComposerMode(null);
    setComposerMinimized(false);
    setComposerExpanded(false);
  };

  const resetComposer = () => {
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
  };

  const discardComposer = () => {
    resetComposer();
    closeComposer();
  };

  const openReply = (email: { from: string; subject: string }) => {
    setTo(email.from);
    setCc("");
    setBcc("");

    setSubject(
      email.subject.toLowerCase().startsWith("re:")
        ? email.subject
        : `Re: ${email.subject}`,
    );

    setBody("");
    openComposer("reply");
  };

  const openForward = (email: {
    from: string;
    to: string;
    subject: string;
    body: string;
  }) => {
    setTo("");
    setCc("");
    setBcc("");

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
    openComposer("forward");
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
              onClick={() => {
                resetComposer();
                openComposer("compose");
              }}
            >
              <MailPlus className="h-3.5 w-3.5" />
              Compose
            </Button>
          </div>
        </div>

        {(refreshInbox.error ?? refreshInbox.data) && (
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

        <div className="bg-muted/20 min-h-0 flex-1 overflow-y-auto">
          {selectedId ? (
            <FullEmailView
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
          ) : (
            <section className="bg-background min-h-full">
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
          )}
        </div>
      </div>

      {composerMode && (
        <EmailComposer
          mode={composerMode}
          to={to}
          cc={cc}
          bcc={bcc}
          subject={subject}
          body={body}
          onToChange={setTo}
          onCcChange={setCc}
          onBccChange={setBcc}
          onSubjectChange={setSubject}
          onBodyChange={setBody}
          minimized={composerMinimized}
          expanded={composerExpanded}
          onMinimize={() => setComposerMinimized(true)}
          onRestore={() => setComposerMinimized(false)}
          onExpandToggle={() => setComposerExpanded((expanded) => !expanded)}
          onDiscard={discardComposer}
          onSaveDraft={
            composerMode === "reply"
              ? undefined
              : () => createDraft.mutate({ to, cc, bcc, subject, body })
          }
          onSend={() => {
            if (composerMode === "reply") {
              if (!selectedEmail.data?.threadId) return;

              replyToMessage.mutate({
                threadId: selectedEmail.data.threadId,
                to,
                cc,
                bcc,
                subject,
                body,
              });
              return;
            }

            sendEmail.mutate({ to, cc, bcc, subject, body });
          }}
          canSend={
            composerMode === "reply"
              ? Boolean(to && subject && body && selectedEmail.data?.threadId)
              : canSubmitCompose
          }
          isSaving={createDraft.isPending}
          isSending={
            composerMode === "reply"
              ? replyToMessage.isPending
              : sendEmail.isPending
          }
          error={
            composerMode === "reply"
              ? replyToMessage.error?.message
              : (createDraft.error ?? sendEmail.error)?.message
          }
        />
      )}
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

function FullEmailView({
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
  return (
    <article className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {view}
        </Button>
      </div>

      {isLoading && <StatusLine>Loading message...</StatusLine>}

      {error && <StatusLine tone="error">{error}</StatusLine>}

      {selectedEmail && (
        <div className="bg-card text-card-foreground border-border/80 rounded-lg border p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading min-w-0 text-2xl leading-tight font-semibold">
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

function EmailComposer({
  mode,
  to,
  cc,
  bcc,
  subject,
  body,
  onToChange,
  onCcChange,
  onBccChange,
  onSubjectChange,
  onBodyChange,
  minimized,
  expanded,
  onMinimize,
  onRestore,
  onExpandToggle,
  onDiscard,
  onSaveDraft,
  onSend,
  canSend,
  isSaving,
  isSending,
  error,
}: {
  mode: ComposerMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  onToChange: (value: string) => void;
  onCcChange: (value: string) => void;
  onBccChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  minimized: boolean;
  expanded: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onExpandToggle: () => void;
  onDiscard: () => void;
  onSaveDraft?: () => void;
  onSend: () => void;
  canSend: boolean;
  isSaving: boolean;
  isSending: boolean;
  error?: string;
}) {
  const title =
    mode === "compose" ? "New message" : mode === "reply" ? "Reply" : "Forward";
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [ccVisible, setCcVisible] = useState(Boolean(cc));
  const [bccVisible, setBccVisible] = useState(Boolean(bcc));

  useEffect(() => {
    if (cc) setCcVisible(true);
  }, [cc]);

  useEffect(() => {
    if (bcc) setBccVisible(true);
  }, [bcc]);

  if (minimized) {
    return (
      <div className="bg-popover fixed right-3 bottom-3 z-40 w-[min(24rem,calc(100vw-1.5rem))] rounded-t-lg border shadow-lg">
        <button
          type="button"
          onClick={onRestore}
          className="hover:bg-muted flex h-10 w-full items-center justify-between gap-3 rounded-t-lg px-3 text-left text-sm font-medium"
        >
          <span className="truncate">{subject || title}</span>
          <span className="text-muted-foreground text-xs">Open</span>
        </button>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "bg-popover text-popover-foreground fixed z-40 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg border shadow-2xl",
        expanded
          ? "inset-4 md:inset-x-[10vw] md:inset-y-8"
          : "right-3 bottom-3 left-3 sm:left-auto sm:w-[38rem]",
      )}
      aria-label={title}
    >
      <ComposerHeader
        title={title}
        expanded={expanded}
        onMinimize={onMinimize}
        onExpandToggle={onExpandToggle}
        onDiscard={onDiscard}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 py-2">
          <RecipientField
            value={to}
            onChange={onToChange}
            onShowCc={() => setCcVisible(true)}
            onShowBcc={() => setBccVisible(true)}
            showCcButton={!ccVisible}
            showBccButton={!bccVisible}
          />
        </div>

        {ccVisible && (
          <div className="border-b px-4 py-2">
            <ComposerAddressField
              label="Cc"
              value={cc}
              onChange={onCcChange}
              placeholder="Optional recipients"
            />
          </div>
        )}

        {bccVisible && (
          <div className="border-b px-4 py-2">
            <ComposerAddressField
              label="Bcc"
              value={bcc}
              onChange={onBccChange}
              placeholder="Hidden recipients"
            />
          </div>
        )}

        <div className="border-b px-4 py-2">
          <SubjectField value={subject} onChange={onSubjectChange} />
        </div>

        <MessageEditor
          value={body}
          onChange={onBodyChange}
          placeholder={
            mode === "reply"
              ? "Write your reply..."
              : mode === "forward"
                ? "Write a message..."
                : "Message"
          }
        />

        {error && (
          <p className="text-destructive border-t px-4 py-2 text-sm">{error}</p>
        )}

        <ComposerToolbar
          canSend={canSend}
          isSending={isSending}
          isSaving={isSaving}
          sendLabel={
            mode === "reply"
              ? "Send Reply"
              : mode === "forward"
                ? "Forward"
                : "Send"
          }
          onSend={onSend}
          onSaveDraft={onSaveDraft}
          onDiscard={onDiscard}
          emojiOpen={emojiOpen}
          onEmojiOpenChange={setEmojiOpen}
        />
      </div>
    </section>
  );
}

function ComposerHeader({
  title,
  expanded,
  onMinimize,
  onExpandToggle,
  onDiscard,
}: {
  title: string;
  expanded: boolean;
  onMinimize: () => void;
  onExpandToggle: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="bg-muted/60 flex h-10 shrink-0 items-center justify-between gap-3 border-b px-3">
      <h3 className="truncate text-sm font-semibold">{title}</h3>

      <div className="flex items-center gap-1">
        <IconButton label="Minimize" onClick={onMinimize}>
          <Minimize2 className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label={expanded ? "Restore composer" : "Expand composer"}
          onClick={onExpandToggle}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Discard draft" onClick={onDiscard}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function RecipientField({
  value,
  onChange,
  onShowCc,
  onShowBcc,
  showCcButton,
  showBccButton,
}: {
  value: string;
  onChange: (value: string) => void;
  onShowCc: () => void;
  onShowBcc: () => void;
  showCcButton: boolean;
  showBccButton: boolean;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium">To</span>
      <Input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="name@example.com"
        className="h-7 border-0 bg-transparent! px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent!"
      />

      <div className="flex items-center gap-1">
        {showCcButton && (
          <button
            type="button"
            onClick={onShowCc}
            className="text-muted-foreground hover:text-foreground rounded px-1.5 py-1 text-xs font-medium"
          >
            Cc
          </button>
        )}
        {showBccButton && (
          <button
            type="button"
            onClick={onShowBcc}
            className="text-muted-foreground hover:text-foreground rounded px-1.5 py-1 text-xs font-medium"
          >
            Bcc
          </button>
        )}
      </div>
    </div>
  );
}

function ComposerAddressField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "email" | "text";
}) {
  return (
    <label className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 border-0 bg-transparent! px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent!"
      />
    </label>
  );
}

function SubjectField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Subject"
      className="h-7 border-0 bg-transparent! px-0 font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent!"
    />
  );
}

function MessageEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.textContent === value) return;

    editor.textContent = value;
  }, [value]);

  return (
    <div className="relative min-h-72 flex-1 overflow-y-auto px-4 py-3">
      {!value && (
        <p className="text-muted-foreground pointer-events-none absolute text-sm">
          {placeholder}
        </p>
      )}
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={(event) => {
          onChange(event.currentTarget.innerText);
        }}
        className="min-h-64 text-sm leading-6 whitespace-pre-wrap outline-none"
      />
    </div>
  );
}

function ComposerToolbar({
  canSend,
  isSending,
  isSaving,
  sendLabel,
  onSend,
  onSaveDraft,
  onDiscard,
  emojiOpen,
  onEmojiOpenChange,
}: {
  canSend: boolean;
  isSending: boolean;
  isSaving: boolean;
  sendLabel: string;
  onSend: () => void;
  onSaveDraft?: () => void;
  onDiscard: () => void;
  emojiOpen: boolean;
  onEmojiOpenChange: (open: boolean) => void;
}) {
  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const insertEmoji = (emoji: string) => {
    applyFormat("insertText", emoji);
    onEmojiOpenChange(false);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Button
          type="button"
          onClick={onSend}
          disabled={isSending || !canSend}
          className="h-8 px-4"
        >
          <Send className="h-3.5 w-3.5" />
          {isSending ? "Sending" : sendLabel}
        </Button>

        {onSaveDraft && (
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSaving || !canSend}
            className="h-8"
          >
            {isSaving ? "Saving" : "Save draft"}
          </Button>
        )}

        <div className="bg-border mx-1 h-5 w-px" />

        <ToolbarButton label="Bold" onClick={() => applyFormat("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => applyFormat("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          onClick={() => applyFormat("underline")}
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => applyFormat("insertOrderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          onClick={() => applyFormat("insertUnorderedList")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          onClick={() => applyFormat("formatBlock", "blockquote")}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert link"
          onClick={() => {
            const href = window.prompt("Paste a link");
            if (!href) return;
            applyFormat("createLink", href);
          }}
        >
          <Link className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Clear formatting"
          onClick={() => applyFormat("removeFormat")}
        >
          <Eraser className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="relative">
          <ToolbarButton
            label="Insert emoji"
            onClick={() => onEmojiOpenChange(!emojiOpen)}
          >
            <Smile className="h-3.5 w-3.5" />
          </ToolbarButton>

          {emojiOpen && (
            <div className="bg-popover absolute bottom-9 left-0 z-50 flex gap-1 rounded-lg border p-1 shadow-lg">
              {["🙂", "👍", "🎉", "❤️", "🙏"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-md text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolbarButton label="Attachments are not available yet" disabled>
          <Paperclip className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Image insertion is not available yet" disabled>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Plain text delivery" disabled>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={onDiscard}
        aria-label="Discard"
        title="Discard"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <IconButton label={label} onClick={onClick} disabled={disabled}>
      {children}
    </IconButton>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      {children}
    </button>
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
