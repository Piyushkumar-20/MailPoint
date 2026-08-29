"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Mail,
  MailOpen,
  Users,
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

type MeetingSlot = { start: string; end: string };

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const MEETING_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${String(hours).padStart(2, "0")}:${minutes}`;
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";

  return {
    value,
    label: `${hour12}:${minutes} ${period}`,
  };
});

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractEmails(value: string | undefined) {
  if (!value) return [];
  return value.match(EMAIL_PATTERN) ?? [];
}

function getMeetingAttendeeCandidates(
  email: { from: string; to: string },
  view: "inbox" | "starred" | "drafts" | "sent",
) {
  const orderedSources =
    view === "sent" ? [email.to, email.from] : [email.from, email.to];

  return Array.from(
    new Set(orderedSources.flatMap((source) => extractEmails(source))),
  );
}

function formatMeetingTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function GmailPanel({
  view,
  searchQuery,
  calendarComposeRequest,
}: {
  view: "inbox" | "starred" | "drafts" | "sent";
  /** The active (submitted) search query, controlled by the header search box. */
  searchQuery: string;
  calendarComposeRequest?: {
    to: string;
    subject: string;
    body: string;
    requestId: number;
  } | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [composerMinimized, setComposerMinimized] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [meetingDate, setMeetingDate] = useState(() => getLocalDateValue());
  const [meetingStartTime, setMeetingStartTime] = useState("09:00");
  const [meetingEndTime, setMeetingEndTime] = useState("18:00");
  const [scheduleAttendee, setScheduleAttendee] = useState("");
  const [hasSearchedAvailability, setHasSearchedAvailability] = useState(false);
  const [selectedMeetingSlot, setSelectedMeetingSlot] =
    useState<MeetingSlot | null>(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const utils = api.useUtils();

  const selectedEmail = api.gmail.getMessage.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const attendeeCandidates = useMemo(() => {
    if (!selectedEmail.data) return [];

    return getMeetingAttendeeCandidates(
      {
        from: selectedEmail.data.from,
        to: selectedEmail.data.to,
      },
      view,
    );
  }, [selectedEmail.data, view]);

  const availabilityQuery = api.calendar.getAvailability.useQuery(
    {
      timeMin: new Date(`${meetingDate}T${meetingStartTime}:00`).toISOString(),
      timeMax: new Date(`${meetingDate}T${meetingEndTime}:00`).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      durationMinutes: meetingDuration,
      calendarIds: ["primary", ...(scheduleAttendee ? [scheduleAttendee] : [])],
    },
    {
      enabled:
        scheduleOpen &&
        hasSearchedAvailability &&
        Boolean(scheduleAttendee) &&
        meetingStartTime < meetingEndTime,
      staleTime: 0,
    },
  );

  const sendMeetingInvite = api.calendar.sendInvite.useMutation({
    onSuccess: () => {
      setSelectedMeetingSlot(null);
      setScheduleOpen(false);
      void utils.calendar.searchEvents.invalidate();
    },
  });

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

  const markAsRead = api.gmail.modifyMessageLabels.useMutation({
    onMutate: async ({ messageId }) => {
      await utils.gmail.searchEmails.cancel();

      utils.gmail.searchEmails.setData(
        {
          query: searchQuery,
          limit: 50,
          offset: 0,
          mailbox,
        },
        (current) => {
          if (!current) return current;

          return current.map((email) =>
            email.id === messageId
              ? {
                  ...email,
                  labelIds: email.labelIds.filter(
                    (labelId) => labelId !== "UNREAD",
                  ),
                }
              : email,
          );
        },
      );
    },
    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
    },
    onError: async () => {
      await utils.gmail.searchEmails.invalidate();
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

  useEffect(() => {
    if (!calendarComposeRequest) return;

    setTo(calendarComposeRequest.to);
    setCc("");
    setBcc("");
    setSubject(calendarComposeRequest.subject);
    setBody(calendarComposeRequest.body);
    setComposerMode("compose");
    setComposerMinimized(false);
    setComposerExpanded(false);
  }, [calendarComposeRequest]);

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

  const handleForwardFromList = async (messageId: string) => {
    try {
      const email = await utils.gmail.getMessage.fetch({ id: messageId });

      if (!email) return;

      openForward(email);
    } catch {
      // The existing message view will surface fetch errors if the message cannot be opened.
    }
  };

  const isStarred = selectedEmail.data?.labelIds?.includes("STARRED") ?? false;
  const createScheduledMeeting = () => {
    if (!selectedMeetingSlot || !selectedEmail.data || !scheduleAttendee)
      return;

    const start = new Date(selectedMeetingSlot.start);
    const end = new Date(selectedMeetingSlot.end);
    const requestedStart = new Date(`${meetingDate}T${meetingStartTime}:00`);
    const requestedEnd = new Date(`${meetingDate}T${meetingEndTime}:00`);
    const expectedDurationMs = meetingDuration * 60 * 1000;

    const isValidSelectedSlot =
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      start < end &&
      getLocalDateValue(start) === meetingDate &&
      start >= requestedStart &&
      end <= requestedEnd &&
      end.getTime() - start.getTime() === expectedDurationMs;

    if (!isValidSelectedSlot) {
      setSelectedMeetingSlot(null);
      setHasSearchedAvailability(false);
      return;
    }

    sendMeetingInvite.mutate({
      summary: selectedEmail.data.subject || "Meeting",
      description: `Scheduled from email conversation.\n\nOriginal email subject: ${selectedEmail.data.subject || "(no subject)"}`,
      start: selectedMeetingSlot.start,
      end: selectedMeetingSlot.end,
      attendees: [scheduleAttendee],
    });
  };

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
              onScheduleMeeting={() => setScheduleOpen(true)}
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
                  onSelect={(messageId) => {
                    setSelectedId(messageId);
                    markAsRead.mutate({
                      messageId,
                      removeLabelIds: ["UNREAD"],
                    });
                  }}
                  onDelete={(messageId) => deleteMessage.mutate({ messageId })}
                  onReply={openReply}
                  onForwardRequest={handleForwardFromList}
                  onToggleRead={(email) => {
                    const isUnread = email.labelIds.includes("UNREAD");

                    modifyMessageLabels.mutate({
                      messageId: email.id,
                      ...(isUnread
                        ? { removeLabelIds: ["UNREAD"] }
                        : { addLabelIds: ["UNREAD"] }),
                    });
                  }}
                  onToggleStar={(email) => {
                    const isStarred = email.labelIds.includes("STARRED");

                    modifyMessageLabels.mutate({
                      messageId: email.id,
                      ...(isStarred
                        ? { removeLabelIds: ["STARRED"] }
                        : { addLabelIds: ["STARRED"] }),
                    });
                  }}
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

      {scheduleOpen && (
        <ScheduleMeetingDialog
          attendee={scheduleAttendee}
          attendeeCandidates={attendeeCandidates}
          subject={selectedEmail.data?.subject ?? ""}
          duration={meetingDuration}
          date={meetingDate}
          startTime={meetingStartTime}
          endTime={meetingEndTime}
          selectedSlot={selectedMeetingSlot}
          availability={availabilityQuery.data}
          isLoadingAvailability={availabilityQuery.isLoading}
          availabilityError={availabilityQuery.error?.message}
          isSending={sendMeetingInvite.isPending}
          sendError={sendMeetingInvite.error?.message}
          onAttendeeChange={(value) => {
            setScheduleAttendee(value);
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(false);
          }}
          onDurationChange={(value) => {
            setMeetingDuration(value);
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(false);
          }}
          onDateChange={(value) => {
            setMeetingDate(value);
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(false);
          }}
          onStartTimeChange={(value) => {
            setMeetingStartTime(value);
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(false);
          }}
          onEndTimeChange={(value) => {
            setMeetingEndTime(value);
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(false);
          }}
          onSelectSlot={setSelectedMeetingSlot}
          onFindAvailability={() => {
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(true);
            void availabilityQuery.refetch();
          }}
          onCreateMeeting={createScheduledMeeting}
          onClose={() => {
            setSelectedMeetingSlot(null);
            setHasSearchedAvailability(false);
            setScheduleOpen(false);
          }}
        />
      )}

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
  onReply,
  onForwardRequest,
  onToggleRead,
  onToggleStar,
  isDeleting,
}: {
  emails:
    | {
        id: string;
        subject: string;
        snippet: string;
        from: string;
        date: string | null;
        labelIds: string[];
      }[]
    | undefined;
  isLoading: boolean;
  error?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (email: { from: string; subject: string }) => void;
  onForwardRequest: (messageId: string) => void;
  onToggleRead: (email: { id: string; labelIds: string[] }) => void;
  onToggleStar: (email: { id: string; labelIds: string[] }) => void;
  isDeleting: boolean;
}) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    emailId: string;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);

    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  if (isLoading) return <StatusLine>Loading mail...</StatusLine>;
  if (error) return <StatusLine tone="error">{error}</StatusLine>;

  if (!emails || emails.length === 0) {
    return (
      <EmptyPanel
        title="No emails yet"
        description="Try refreshing from Gmail."
      />
    );
  }

  const contextEmail = contextMenu
    ? emails.find((email) => email.id === contextMenu.emailId)
    : undefined;

  return (
    <>
      <ul>
        {emails.map((email) => {
        const isUnread = email.labelIds.includes("UNREAD");

        return (
          <li
            key={email.id}
            className="border-b"
            onContextMenu={(event) => {
              event.preventDefault();

              setContextMenu({
                x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
                y: Math.max(8, Math.min(event.clientY, window.innerHeight - 260)),
                emailId: email.id,
              });
            }}
          >
            <div
              className={cn(
                "group hover:bg-muted/60 grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3 text-left transition-colors",
                isUnread && "bg-muted/40",
                selectedId === email.id && "bg-accent",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(email.id)}
                className="min-w-0 text-left"
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      isUnread
                        ? "font-semibold text-foreground"
                        : "font-normal text-foreground",
                    )}
                  >
                    {email.from ? formatSender(email.from) : "Unknown sender"}
                  </span>

                  <span
                    className={cn(
                      "mt-0.5 block truncate text-sm",
                      isUnread
                        ? "font-semibold text-foreground"
                        : "font-normal text-muted-foreground",
                    )}
                  >
                    {email.subject || "(no subject)"}
                  </span>

                  {email.snippet && (
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {email.snippet}
                    </span>
                  )}
                </span>
              </button>

              <div className="flex shrink-0 items-start gap-2">
                {email.date && (
                  <span
                    className={cn(
                      "pt-0.5 text-xs",
                      isUnread
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatMessageDate(email.date)}
                  </span>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
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
        );
      })}

      </ul>

      {contextEmail && contextMenu && (
        <div
          className="bg-popover text-popover-foreground border-border fixed z-50 min-w-52 rounded-md border p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <ContextMenuAction
            icon={<MailOpen className="h-4 w-4" />}
            label="Open"
            onClick={() => {
              setContextMenu(null);
              onSelect(contextEmail.id);
            }}
          />

          <ContextMenuAction
            icon={<ReplyIcon className="h-4 w-4" />}
            label="Reply"
            onClick={() => {
              setContextMenu(null);
              onReply({
                from: contextEmail.from,
                subject: contextEmail.subject,
              });
            }}
          />

          <ContextMenuAction
            icon={<ForwardIcon className="h-4 w-4" />}
            label="Forward"
            onClick={() => {
              setContextMenu(null);
              onForwardRequest(contextEmail.id);
            }}
          />

          <div className="bg-border my-1 h-px" />

          <ContextMenuAction
            icon={
              contextEmail.labelIds.includes("UNREAD") ? (
                <MailOpen className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )
            }
            label={
              contextEmail.labelIds.includes("UNREAD")
                ? "Mark as read"
                : "Mark as unread"
            }
            onClick={() => {
              setContextMenu(null);
              onToggleRead(contextEmail);
            }}
          />

          <ContextMenuAction
            icon={
              <Star
                className={cn(
                  "h-4 w-4",
                  contextEmail.labelIds.includes("STARRED") &&
                    "fill-primary text-primary",
                )}
              />
            }
            label={
              contextEmail.labelIds.includes("STARRED")
                ? "Unstar"
                : "Star"
            }
            onClick={() => {
              setContextMenu(null);
              onToggleStar(contextEmail);
            }}
          />

          <div className="bg-border my-1 h-px" />

          <ContextMenuAction
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete"
            destructive
            onClick={() => {
              setContextMenu(null);

              const confirmed = window.confirm("Move this email to Trash?");
              if (!confirmed) return;

              onDelete(contextEmail.id);
            }}
          />
        </div>
      )}
    </>
  );
}

function ContextMenuAction({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
        "hover:bg-muted",
        destructive ? "text-destructive" : "text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
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
  onScheduleMeeting,
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
  onScheduleMeeting: () => void;
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

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onScheduleMeeting}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Schedule meeting
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function ScheduleMeetingDialog({
  attendee,
  attendeeCandidates,
  subject,
  duration,
  date,
  startTime,
  endTime,
  selectedSlot,
  availability,
  isLoadingAvailability,
  availabilityError,
  isSending,
  sendError,
  onAttendeeChange,
  onDurationChange,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onSelectSlot,
  onFindAvailability,
  onCreateMeeting,
  onClose,
}: {
  attendee: string;
  attendeeCandidates: string[];
  subject: string;
  duration: number;
  date: string;
  startTime: string;
  endTime: string;
  selectedSlot: { start: string; end: string } | null;
  availability?: {
    attendeeAvailability: "available" | "partial" | "unknown";
    slots: { start: string; end: string }[];
    warnings: string[];
  };
  isLoadingAvailability: boolean;
  availabilityError?: string;
  isSending: boolean;
  sendError?: string;
  onAttendeeChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSelectSlot: (slot: { start: string; end: string }) => void;
  onFindAvailability: () => void;
  onCreateMeeting: () => void;
  onClose: () => void;
}) {
  const canSearch =
    Boolean(attendee) &&
    Boolean(date) &&
    startTime < endTime &&
    !isLoadingAvailability;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule meeting"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="bg-card text-card-foreground flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Schedule meeting</h2>
                <p className="text-muted-foreground max-w-md truncate text-xs">
                  {subject || "Meeting from email"}
                </p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
          >
            ×
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <div className="bg-muted/35 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Attendee
              </div>
              {attendeeCandidates.length > 1 ? (
                <select
                  value={attendee}
                  onChange={(event) => onAttendeeChange(event.target.value)}
                  className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm outline-none"
                >
                  {attendeeCandidates.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-muted-foreground mt-1 text-sm">
                  {attendee || "No attendee detected"}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Duration</span>
                <select
                  value={duration}
                  onChange={(e) => onDurationChange(Number(e.target.value))}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Date</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="composer-input"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">From</span>
                <select
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none"
                >
                  {MEETING_TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Until</span>
                <select
                  value={endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none"
                >
                  {MEETING_TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!attendee && (
              <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
                We couldn&apos;t find an email address in this message to use as
                the attendee.
              </p>
            )}
            {startTime >= endTime && (
              <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
                The end time must be later than the start time.
              </p>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onFindAvailability}
                disabled={!canSearch}
              >
                {isLoadingAvailability ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking calendars
                  </>
                ) : (
                  <>
                    <Clock3 className="h-3.5 w-3.5" />
                    Find available times
                  </>
                )}
              </Button>
            </div>
            {availabilityError && (
              <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
                {availabilityError}
              </p>
            )}
            {availability && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Available times</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {availability.attendeeAvailability === "unknown"
                      ? "Only your calendar could be checked."
                      : "These times are free on both calendars."}
                  </p>
                </div>
                {availability.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
                  >
                    {warning}
                  </div>
                ))}
                {availability.slots.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availability.slots.map((slot) => {
                      const isSelected =
                        selectedSlot?.start === slot.start &&
                        selectedSlot?.end === slot.end;
                      return (
                        <button
                          key={`${slot.start}-${slot.end}`}
                          type="button"
                          onClick={() => onSelectSlot(slot)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "hover:bg-muted/60",
                          )}
                        >
                          {formatMeetingTime(slot.start)} –{" "}
                          {formatMeetingTime(slot.end)}
                          {isSelected && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                    <p className="text-sm font-medium">
                      No matching time slots
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Try a wider time window or a different date.
                    </p>
                  </div>
                )}
              </div>
            )}
            {sendError && (
              <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
                {sendError}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onCreateMeeting}
            disabled={!selectedSlot || isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending invite
              </>
            ) : (
              <>
                <CalendarDays className="h-3.5 w-3.5" />
                Create & send invite
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
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
        className="composer-input"
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
        className="composer-input"
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
      className="composer-input font-medium"
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
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    orderedList: false,
    unorderedList: false,
    quote: false,
  });

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      orderedList: document.queryCommandState("insertOrderedList"),
      unorderedList: document.queryCommandState("insertUnorderedList"),
      quote:
        String(document.queryCommandValue("formatBlock")).toLowerCase() ===
        "blockquote",
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats);

    return () => {
      document.removeEventListener("selectionchange", updateActiveFormats);
    };
  }, [updateActiveFormats]);

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    window.requestAnimationFrame(updateActiveFormats);
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

        <ToolbarButton
          label="Bold"
          active={activeFormats.bold}
          onClick={() => applyFormat("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={activeFormats.italic}
          onClick={() => applyFormat("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={activeFormats.underline}
          onClick={() => applyFormat("underline")}
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={activeFormats.orderedList}
          onClick={() => applyFormat("insertOrderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          active={activeFormats.unorderedList}
          onClick={() => applyFormat("insertUnorderedList")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={activeFormats.quote}
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
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <IconButton
      label={label}
      onClick={onClick}
      disabled={disabled}
      active={active}
    >
      {children}
    </IconButton>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent",
        active &&
          "border-primary/25 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
      )}
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
