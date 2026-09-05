"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArchiveRestore,
  ArrowLeft,
  Bold,
  CalendarDays,
  Check,
  Clock3,
  Info,
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
  Sparkles,
} from "lucide-react";
import DOMPurify from "dompurify";

import { formatMessageDate, formatSender, LinkifiedText } from "@/lib/display";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityBadge, type PriorityType } from "@/components/priority-badge";
import type { PriorityFilterOption } from "@/components/search-bar";

type ComposerMode = "compose" | "reply" | "forward";

type MeetingSlot = { start: string; end: string };

type ConfirmDialogState =
  | { type: "normalDelete"; messageId: string }
  | { type: "bulkNormalDelete"; messageIds: string[] }
  | { type: "permanentDelete"; messageId: string }
  | { type: "bulkPermanentDelete"; messageIds: string[] }
  | { type: "emptyTrash" }
  | null;

type ToastState = {
  message: string;
  subMessage?: string;
  onUndo?: () => void;
} | null;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  important: 3,
  normal: 2,
  low: 1,
};

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
  view: "inbox" | "starred" | "drafts" | "sent" | "trash",
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
  searchMode = "hybrid",
  priorityFilter = "all",
  onPriorityFilterChange,
  calendarComposeRequest,
}: {
  view: "inbox" | "starred" | "drafts" | "sent" | "trash";
  /** The active (submitted) search query, controlled by the header search box. */
  searchQuery: string;
  searchMode?: "hybrid" | "semantic" | "keyword";
  priorityFilter?: PriorityFilterOption;
  onPriorityFilterChange?: (priority: PriorityFilterOption) => void;
  calendarComposeRequest?: {
    to: string;
    subject: string;
    body: string;
    requestId: number;
  } | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [composerMinimized, setComposerMinimized] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Intelligence & Sorting states
  const [sortMode, setSortMode] = useState<"date-desc" | "priority-desc" | "date-asc">("date-desc");
  const [internalPriorityFilter, setInternalPriorityFilter] = useState<PriorityFilterOption>("all");
  const activePriorityFilter = priorityFilter ?? internalPriorityFilter;
  const setActivePriorityFilter = onPriorityFilterChange ?? setInternalPriorityFilter;

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

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  const mailbox =
    view === "starred"
      ? "starred"
      : view === "sent"
        ? "sent"
        : view === "trash"
          ? "trash"
          : "inbox";

  // Check if intelligent search (hybrid or semantic) is requested
  const isSearchActive = Boolean(searchQuery.trim());
  const isSemanticOrHybridSearch = isSearchActive && (searchMode === "hybrid" || searchMode === "semantic");

  // 1. Intelligent Search Query (handles semantic & hybrid modes)
  const intelligentSearch = api.intelligence.searchEmails.useQuery(
    {
      query: searchQuery,
      mode: searchMode,
      mailbox,
      priority: activePriorityFilter,
      limit: 50,
    },
    {
      enabled: isSemanticOrHybridSearch,
    },
  );

  // 2. Standard Gmail Search Query (handles standard mailbox view and keyword search)
  const emails = api.gmail.searchEmails.useQuery(
    {
      query: searchQuery,
      limit: 50,
      offset: 0,
      mailbox,
    },
    {
      enabled:
        (view === "inbox" ||
          view === "starred" ||
          view === "sent" ||
          view === "trash") &&
        !isSemanticOrHybridSearch,
    },
  );

  // Resolve raw email list based on active mode
  const rawEmailsList = useMemo(() => {
    if (isSemanticOrHybridSearch) {
      return intelligentSearch.data?.items ?? [];
    }
    return emails.data ?? [];
  }, [isSemanticOrHybridSearch, intelligentSearch.data, emails.data]);

  const visibleMessageIds = useMemo(
    () => rawEmailsList.map((m) => m.id),
    [rawEmailsList],
  );

  // 3. Query stored classifications for visible emails
  const classificationsQuery = api.intelligence.getClassifications.useQuery(
    { messageIds: visibleMessageIds },
    { enabled: visibleMessageIds.length > 0 },
  );

  // 4. Background batch classification mutation
  const classifyBatch = api.intelligence.classifyBatch.useMutation({
    onSuccess: async () => {
      await utils.intelligence.getClassifications.invalidate();
    },
  });

  // Track emails already dispatched for background classification
  const dispatchedClassificationRef = useRef<Set<string>>(new Set());

  // Automatically trigger background classification for unclassified emails
  useEffect(() => {
    if (!classificationsQuery.data || rawEmailsList.length === 0) return;

    const unclassified = rawEmailsList.filter((email) => {
      const isClassified = Boolean(classificationsQuery.data[email.id]);
      const isAlreadyDispatched = dispatchedClassificationRef.current.has(email.id);
      return !isClassified && !isAlreadyDispatched;
    });

    if (unclassified.length > 0) {
      for (const email of unclassified) {
        dispatchedClassificationRef.current.add(email.id);
      }

      classifyBatch.mutate({
        emails: unclassified.map((e) => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          to: e.to,
          snippet: e.snippet,
          date: e.date,
          labelIds: e.labelIds,
        })),
      });
    }
  }, [classificationsQuery.data, rawEmailsList, classifyBatch]);

  // 5. User manual priority override mutation
  const overridePriorityMutation = api.intelligence.overridePriority.useMutation({
    onSuccess: async () => {
      await utils.intelligence.getClassifications.invalidate();
      setToast({
        message: "Email priority updated.",
        subMessage: "Your manual preference is saved.",
      });
    },
  });

  // 6. User explicit Re-analyze with AI mutation
  const reanalyzeMutation = api.intelligence.reanalyzeEmail.useMutation({
    onSuccess: async () => {
      await utils.intelligence.getClassifications.invalidate();
      setToast({
        message: "Email re-analyzed with AI.",
        subMessage: "New priority classification applied.",
      });
    },
  });

  const processedEmails = useMemo(() => {
    const classifications = classificationsQuery.data ?? {};
    let list = [...rawEmailsList];

    // Priority filter (for normal list where query didn't pre-filter)
    if (!isSemanticOrHybridSearch && activePriorityFilter !== "all") {
      list = list.filter((email) => {
        const cls = classifications[email.id];
        const p = cls?.priority ?? "normal";
        if (activePriorityFilter === "high") {
          return p === "urgent" || p === "important";
        }
        return p === activePriorityFilter;
      });
    }

    // Sort mode
    if (sortMode === "priority-desc") {
      list.sort((a, b) => {
        const pA = PRIORITY_ORDER[classifications[a.id]?.priority ?? "normal"] ?? 2;
        const pB = PRIORITY_ORDER[classifications[b.id]?.priority ?? "normal"] ?? 2;
        if (pB !== pA) return pB - pA;
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      });
    } else if (sortMode === "date-asc") {
      list.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    } else {
      // date-desc (default)
      list.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    }

    return list;
  }, [
    rawEmailsList,
    classificationsQuery.data,
    activePriorityFilter,
    sortMode,
    isSemanticOrHybridSearch,
  ]);

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
   * Delete normal Gmail messages (Move to Trash).
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

    onSuccess: async (_, { messageId }) => {
      /*
       * Confirm the optimistic update against the real Gmail state.
       */
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
      setToast({
        message: "Conversation moved to Trash.",
        subMessage: "It will be permanently deleted after 30 days.",
        onUndo: () => {
          restoreMessage.mutate({ messageId });
        },
      });
    },

    onError: async () => {
      /*
       * If Gmail rejects the delete, refetch the list so the removed
       * message comes back.
       */
      await utils.gmail.searchEmails.invalidate();
    },
  });

  // Bulk move to trash
  const deleteMessages = api.gmail.deleteMessages.useMutation({
    onMutate: async ({ messageIds }) => {
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

          return current.filter(
            (email) => !messageIds.includes(email.id),
          );
        },
      );

      setSelectedIds((current) =>
        current.filter((id) => !messageIds.includes(id)),
      );
    },

    onSuccess: async (_, { messageIds }) => {
      await utils.gmail.searchEmails.invalidate();
      setToast({
        message:
          messageIds.length === 1
            ? "Conversation moved to Trash."
            : `${messageIds.length} conversations moved to Trash.`,
        subMessage: "They will be permanently deleted after 30 days.",
        onUndo: () => {
          restoreMessages.mutate({ messageIds });
        },
      });
    },

    onError: async () => {
      await utils.gmail.searchEmails.invalidate();
    },
  });

  // Restore single message from Trash
  const restoreMessage = api.gmail.restoreMessage.useMutation({
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
          return current.filter((email) => email.id !== messageId);
        },
      );

      if (selectedId === messageId) {
        setSelectedId(null);
      }
    },

    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
      setToast({
        message: "Conversation moved to Inbox.",
      });
    },

    onError: async () => {
      await utils.gmail.searchEmails.invalidate();
    },
  });

  // Bulk restore messages from Trash
  const restoreMessages = api.gmail.restoreMessages.useMutation({
    onMutate: async ({ messageIds }) => {
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
          return current.filter((email) => !messageIds.includes(email.id));
        },
      );

      setSelectedIds((current) =>
        current.filter((id) => !messageIds.includes(id)),
      );
    },

    onSuccess: async (_, { messageIds }) => {
      await utils.gmail.searchEmails.invalidate();
      setToast({
        message:
          messageIds.length === 1
            ? "Conversation moved to Inbox."
            : `${messageIds.length} conversations moved to Inbox.`,
      });
    },

    onError: async () => {
      await utils.gmail.searchEmails.invalidate();
    },
  });

  // Delete single message permanently
  const deleteMessagePermanently = api.gmail.deleteMessagePermanently.useMutation({
    onMutate: async ({ messageId }) => {
      await utils.gmail.searchEmails.cancel();

      const previousEmails = utils.gmail.searchEmails.getData({
        query: searchQuery,
        limit: 50,
        offset: 0,
        mailbox,
      });

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

      if (selectedId === messageId) {
        setSelectedId(null);
      }

      return { previousEmails };
    },

    onSuccess: async () => {
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
      setToast({
        message: "Conversation permanently deleted.",
      });
    },

    onError: async (error, _, context) => {
      if (context?.previousEmails) {
        utils.gmail.searchEmails.setData(
          {
            query: searchQuery,
            limit: 50,
            offset: 0,
            mailbox,
          },
          context.previousEmails,
        );
      }
      await utils.gmail.searchEmails.invalidate();
      setToast({
        message: "Failed to permanently delete message",
        subMessage: error.message ?? "An error occurred during permanent deletion.",
      });
    },
  });

  // Bulk delete messages permanently
  const deleteMessagesPermanently = api.gmail.deleteMessagesPermanently.useMutation({
    onMutate: async ({ messageIds }) => {
      await utils.gmail.searchEmails.cancel();

      const previousEmails = utils.gmail.searchEmails.getData({
        query: searchQuery,
        limit: 50,
        offset: 0,
        mailbox,
      });

      utils.gmail.searchEmails.setData(
        {
          query: searchQuery,
          limit: 50,
          offset: 0,
          mailbox,
        },
        (current) => {
          if (!current) return current;
          return current.filter((email) => !messageIds.includes(email.id));
        },
      );

      setSelectedIds((current) =>
        current.filter((id) => !messageIds.includes(id)),
      );

      return { previousEmails };
    },

    onSuccess: async (_, { messageIds }) => {
      await utils.gmail.searchEmails.invalidate();
      setToast({
        message:
          messageIds.length === 1
            ? "Conversation permanently deleted."
            : `${messageIds.length} conversations permanently deleted.`,
      });
    },

    onError: async (error, _, context) => {
      if (context?.previousEmails) {
        utils.gmail.searchEmails.setData(
          {
            query: searchQuery,
            limit: 50,
            offset: 0,
            mailbox,
          },
          context.previousEmails,
        );
      }
      await utils.gmail.searchEmails.invalidate();
      setToast({
        message: "Failed to permanently delete messages",
        subMessage: error.message ?? "An error occurred during bulk permanent deletion.",
      });
    },
  });

  // Empty Trash (only clears UI after backend confirms successful permanent deletion)
  const emptyTrash = api.gmail.emptyTrash.useMutation({
    onSuccess: async () => {
      setSelectedId(null);
      setSelectedIds([]);
      await utils.gmail.searchEmails.invalidate();
      await utils.gmail.getMessage.invalidate();
      setToast({
        message: "Trash emptied.",
      });
    },

    onError: async (error) => {
      await utils.gmail.searchEmails.invalidate();
      setToast({
        message: "Failed to empty Trash",
        subMessage: error.message ?? "An error occurred while emptying Trash.",
      });
    },
  });

//Bulk read/unread + star/unstar
  const modifyMessagesLabels =
  api.gmail.modifyMessagesLabels.useMutation({
    onMutate: async ({
      messageIds,
      addLabelIds,
      removeLabelIds,
    }) => {
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

          return current.map((email) => {
            if (!messageIds.includes(email.id)) {
              return email;
            }

            let labelIds = [...email.labelIds];

            if (addLabelIds) {
              labelIds = Array.from(
                new Set([...labelIds, ...addLabelIds]),
              );
            }

            if (removeLabelIds) {
              labelIds = labelIds.filter(
                (labelId) => !removeLabelIds.includes(labelId),
              );
            }

            return {
              ...email,
              labelIds,
            };
          });
        },
      );
    },

    onSuccess: () => {
      // onMutate already updates the visible mail list optimistically.
      // Avoid invalidating here because it causes an unnecessary
      // refetch and introduces a 2-4 second UI delay.
    },

    onError: async () => {
      // Synchronize with Gmail only when the mutation fails.
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

  const isDeletePending =
    deleteMessage.isPending ||
    deleteMessages.isPending ||
    deleteMessagePermanently.isPending ||
    deleteMessagesPermanently.isPending ||
    emptyTrash.isPending;

  let dialogProps = {
    title: "",
    message: "",
    confirmLabel: "",
    confirmVariant: "default" as "default" | "destructive",
  };

  if (confirmDialog?.type === "normalDelete") {
    dialogProps = {
      title: "Move to Trash?",
      message:
        "This conversation will be moved to Trash and permanently deleted after 30 days.",
      confirmLabel: "Move to Trash",
      confirmVariant: "default",
    };
  } else if (confirmDialog?.type === "bulkNormalDelete") {
    const count = confirmDialog.messageIds.length;
    dialogProps = {
      title: "Move to Trash?",
      message: `Move ${count} conversation${count === 1 ? "" : "s"} to Trash? They will be permanently deleted after 30 days.`,
      confirmLabel: "Move to Trash",
      confirmVariant: "default",
    };
  } else if (confirmDialog?.type === "permanentDelete") {
    dialogProps = {
      title: "Delete permanently?",
      message:
        "This message will be permanently deleted and cannot be recovered.",
      confirmLabel: "Delete permanently",
      confirmVariant: "destructive",
    };
  } else if (confirmDialog?.type === "bulkPermanentDelete") {
    const count = confirmDialog.messageIds.length;
    dialogProps = {
      title: "Delete messages permanently?",
      message: `This will permanently delete ${count} message${count === 1 ? "" : "s"}. They cannot be recovered.`,
      confirmLabel: "Delete permanently",
      confirmVariant: "destructive",
    };
  } else if (confirmDialog?.type === "emptyTrash") {
    dialogProps = {
      title: "Empty Trash?",
      message:
        "All messages in Trash will be permanently deleted and cannot be recovered.",
      confirmLabel: "Delete permanently",
      confirmVariant: "destructive",
    };
  }

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
                    : view === "trash"
                      ? "Trash"
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

        {view === "trash" && !selectedId && (
          <div className="bg-muted/40 border-b px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Messages in Trash are permanently deleted after 30 days.
            </span>
            {emails.data && emails.data.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDialog({ type: "emptyTrash" })}
                disabled={isDeletePending}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 font-medium"
              >
                Empty Trash now
              </Button>
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
              classification={classificationsQuery.data?.[selectedId]}
              onOverridePriority={(messageId, priority) =>
                overridePriorityMutation.mutate({ messageId, priority })
              }
              onReanalyze={(email) =>
                reanalyzeMutation.mutate({
                  email: {
                    id: email.id,
                    subject: email.subject,
                    from: email.from,
                    to: email.to,
                    snippet: email.snippet,
                    body: email.body,
                    date: email.date,
                    labelIds: email.labelIds,
                  },
                })
              }
              isReanalyzing={reanalyzeMutation.isPending}
              onDelete={(messageId) => {
                if (view === "trash") {
                  setConfirmDialog({ type: "permanentDelete", messageId });
                } else {
                  setConfirmDialog({ type: "normalDelete", messageId });
                }
              }}
              onRestore={(messageId) => restoreMessage.mutate({ messageId })}
              onPermanentDelete={(messageId) =>
                setConfirmDialog({ type: "permanentDelete", messageId })
              }
              isDeleting={
                deleteMessage.isPending || deleteMessagePermanently.isPending
              }
              isRestoring={restoreMessage.isPending}
            />
          ) : (
            <section className="bg-background min-h-full">
              {(view === "inbox" ||
                view === "starred" ||
                view === "sent" ||
                view === "trash") && (
                <MailList
                  view={view}
                  emails={processedEmails}
                  isLoading={isSemanticOrHybridSearch ? intelligentSearch.isLoading : emails.isLoading}
                  error={isSemanticOrHybridSearch ? intelligentSearch.error?.message : emails.error?.message}
                  classifications={classificationsQuery.data}
                  isClassifying={classifyBatch.isPending}
                  priorityFilter={activePriorityFilter}
                  onPriorityFilterChange={setActivePriorityFilter}
                  sortMode={sortMode}
                  onSortModeChange={setSortMode}
                  searchInfo={
                    isSearchActive
                      ? {
                          query: searchQuery,
                          mode: isSemanticOrHybridSearch ? searchMode : "keyword",
                          totalCount: processedEmails.length,
                          stats: intelligentSearch.data?.stats,
                        }
                      : undefined
                  }
                  selectedId={selectedId}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onSelect={(messageId) => {
                    setSelectedId(messageId);
                    if (view !== "trash") {
                      markAsRead.mutate({
                        messageId,
                        removeLabelIds: ["UNREAD"],
                      });
                    }
                  }}
                  onDelete={(messageId) => {
                    if (view === "trash") {
                      setConfirmDialog({
                        type: "permanentDelete",
                        messageId,
                      });
                    } else {
                      setConfirmDialog({
                        type: "normalDelete",
                        messageId,
                      });
                    }
                  }}
                  onRestore={(messageId) =>
                    restoreMessage.mutate({ messageId })
                  }
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
                  onBulkDelete={() => {
                    if (selectedIds.length === 0) return;

                    if (view === "trash") {
                      setConfirmDialog({
                        type: "bulkPermanentDelete",
                        messageIds: selectedIds,
                      });
                    } else {
                      setConfirmDialog({
                        type: "bulkNormalDelete",
                        messageIds: selectedIds,
                      });
                    }
                  }}
                  onBulkRestore={() => {
                    if (selectedIds.length === 0) return;
                    restoreMessages.mutate({ messageIds: selectedIds });
                  }}
                  onBulkToggleRead={() => {
                    if (selectedIds.length === 0) return;

                    const selectedEmails =
                      emails.data?.filter((email) =>
                        selectedIds.includes(email.id),
                      ) ?? [];

                    const hasUnread = selectedEmails.some((email) =>
                      email.labelIds.includes("UNREAD"),
                    );

                    modifyMessagesLabels.mutate({
                      messageIds: selectedIds,
                      ...(hasUnread
                        ? { removeLabelIds: ["UNREAD"] }
                        : { addLabelIds: ["UNREAD"] }),
                    });
                  }}
                  onBulkToggleStar={() => {
                    if (selectedIds.length === 0) return;

                    const selectedEmails =
                      emails.data?.filter((email) =>
                        selectedIds.includes(email.id),
                      ) ?? [];

                    const hasUnstarred = selectedEmails.some(
                      (email) => !email.labelIds.includes("STARRED"),
                    );

                    modifyMessagesLabels.mutate({
                      messageIds: selectedIds,
                      ...(hasUnstarred
                        ? { addLabelIds: ["STARRED"] }
                        : { removeLabelIds: ["STARRED"] }),
                    });
                  }}
                  isDeleting={
                    deleteMessage.isPending ||
                    deleteMessages.isPending ||
                    deleteMessagePermanently.isPending ||
                    deleteMessagesPermanently.isPending
                  }
                  isRestoring={
                    restoreMessage.isPending || restoreMessages.isPending
                  }
                  isBulkActionPending={modifyMessagesLabels.isPending}
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

      {confirmDialog && (
        <ActionConfirmDialog
          open={Boolean(confirmDialog)}
          title={dialogProps.title}
          message={dialogProps.message}
          confirmLabel={dialogProps.confirmLabel}
          confirmVariant={dialogProps.confirmVariant}
          isPending={isDeletePending}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            if (confirmDialog.type === "normalDelete") {
              deleteMessage.mutate({ messageId: confirmDialog.messageId });
            } else if (confirmDialog.type === "bulkNormalDelete") {
              deleteMessages.mutate({ messageIds: confirmDialog.messageIds });
            } else if (confirmDialog.type === "permanentDelete") {
              deleteMessagePermanently.mutate({
                messageId: confirmDialog.messageId,
              });
            } else if (confirmDialog.type === "bulkPermanentDelete") {
              deleteMessagesPermanently.mutate({
                messageIds: confirmDialog.messageIds,
              });
            } else if (confirmDialog.type === "emptyTrash") {
              emptyTrash.mutate();
            }
            setConfirmDialog(null);
          }}
        />
      )}

      {toast && (
        <NotificationToast
          message={toast.message}
          subMessage={toast.subMessage}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

function MailList({
  view,
  emails,
  isLoading,
  error,
  selectedId,
  selectedIds,
  onSelectionChange,
  onSelect,
  onDelete,
  onRestore,
  onReply,
  onBulkDelete,
  onBulkRestore,
  onBulkToggleRead,
  onBulkToggleStar,
  onForwardRequest,
  onToggleRead,
  onToggleStar,
  isDeleting,
  isRestoring,
  isBulkActionPending,
  classifications,
  isClassifying,
  priorityFilter,
  onPriorityFilterChange,
  sortMode,
  onSortModeChange,
  searchInfo,
}: {
  view: "inbox" | "starred" | "drafts" | "sent" | "trash";
  emails:
    | {
        id: string;
        subject: string;
        snippet: string;
        from: string;
        date: string | null;
        labelIds: string[];
        matchOrigin?: "keyword" | "semantic" | "hybrid";
        relevanceScore?: number;
        matchedFields?: string[];
      }[]
    | undefined;
  isLoading: boolean;
  error?: string;
  selectedId: string | null;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onReply: (email: { from: string; subject: string }) => void;
  onBulkDelete: () => void;
  onBulkRestore?: () => void;
  onBulkToggleRead: () => void;
  onBulkToggleStar: () => void;
  onForwardRequest: (messageId: string) => void;
  onToggleRead: (email: { id: string; labelIds: string[] }) => void;
  onToggleStar: (email: { id: string; labelIds: string[] }) => void;
  isDeleting: boolean;
  isRestoring?: boolean;
  isBulkActionPending: boolean;
  classifications?: Record<
    string,
    {
      priority: string;
      confidence: number;
      reason: string;
      category?: string | null;
      userOverride?: boolean;
    }
  >;
  isClassifying?: boolean;
  priorityFilter?: PriorityFilterOption;
  onPriorityFilterChange?: (priority: PriorityFilterOption) => void;
  sortMode?: "date-desc" | "priority-desc" | "date-asc";
  onSortModeChange?: (mode: "date-desc" | "priority-desc" | "date-asc") => void;
  searchInfo?: {
    query: string;
    mode: string;
    totalCount: number;
    stats?: {
      keywordMatches: number;
      semanticMatches: number;
      hybridMatches: number;
    };
  };
}) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    emailId: string;
  } | null>(null);

  const isTrashView = view === "trash";

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
    return isTrashView ? (
      <EmptyPanel
        title="Trash is empty"
        description="Messages you delete will appear here."
      />
    ) : searchInfo ? (
      <EmptyPanel
        title="No search results"
        description={`No emails matched "${searchInfo.query}" in ${searchInfo.mode} search. Try switching search mode or adjusting filters.`}
      />
    ) : (
      <EmptyPanel
        title="No emails yet"
        description="Try refreshing from Gmail."
      />
    );
  }

  const contextEmail = contextMenu
    ? emails.find((email) => email.id === contextMenu.emailId)
    : undefined;

  const allSelected =
    emails.length > 0 && selectedIds.length === emails.length;

  const hasSelection = selectedIds.length > 0;

  const selectedEmails = emails.filter((email) =>
    selectedIds.includes(email.id),
  );

  const allSelectedUnread =
    hasSelection &&
    selectedEmails.every((email) => email.labelIds.includes("UNREAD"));

  const allSelectedStarred =
    hasSelection &&
    selectedEmails.every((email) => email.labelIds.includes("STARRED"));

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
      return;
    }

    onSelectionChange(emails.map((email) => email.id));
  };

  const toggleSelection = (messageId: string) => {
    if (selectedIds.includes(messageId)) {
      onSelectionChange(
        selectedIds.filter((id) => id !== messageId),
      );
      return;
    }

    onSelectionChange([...selectedIds, messageId]);
  };

  return (
    <>
      <div className="bg-background sticky top-0 z-10 flex min-h-11 items-center gap-2 border-b px-4 py-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleSelectAll}
          aria-label="Select all emails"
          className="h-4 w-4 accent-primary"
        />

        {hasSelection ? (
          <>
            <span className="text-muted-foreground ml-1 text-xs font-medium">
              {selectedIds.length} selected
            </span>

            <div className="bg-border mx-1 h-5 w-px" />

            {isTrashView ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBulkRestore}
                  disabled={Boolean(isRestoring) || isDeleting}
                  title="Move to Inbox"
                  aria-label="Move to Inbox"
                  className="h-8 gap-1.5"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Move to Inbox</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBulkDelete}
                  disabled={isDeleting || Boolean(isRestoring)}
                  title="Delete permanently"
                  aria-label="Delete permanently"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete permanently</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBulkToggleRead}
                  disabled={isBulkActionPending}
                  title={allSelectedUnread ? "Mark as read" : "Mark as unread"}
                  aria-label={allSelectedUnread ? "Mark as read" : "Mark as unread"}
                  className="h-8 gap-1.5"
                >
                  {allSelectedUnread ? (
                    <MailOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {allSelectedUnread ? "Mark read" : "Mark unread"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBulkToggleStar}
                  disabled={isBulkActionPending}
                  title={allSelectedStarred ? "Unstar" : "Star"}
                  aria-label={allSelectedStarred ? "Unstar" : "Star"}
                  className="h-8 gap-1.5"
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      allSelectedStarred && "fill-primary text-primary",
                    )}
                  />
                  <span className="hidden sm:inline">
                    {allSelectedStarred ? "Unstar" : "Star"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBulkDelete}
                  disabled={isDeleting}
                  title="Delete selected emails"
                  aria-label="Delete selected emails"
                  className="text-muted-foreground hover:text-destructive h-8 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange([])}
              title="Clear selection"
              aria-label="Clear selection"
              className="ml-auto h-8 gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">
              Select all
            </span>

            {/* Priority Filter and Sort Controls */}
            <div className="flex items-center gap-2 ml-auto">
              {onPriorityFilterChange && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[11px] hidden sm:inline">Priority:</span>
                  <select
                    value={priorityFilter ?? "all"}
                    onChange={(e) => onPriorityFilterChange(e.target.value as PriorityFilterOption)}
                    aria-label="Filter emails by priority"
                    className="h-7 text-xs bg-muted/40 border border-border/60 rounded px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority (Urgent & Important)</option>
                    <option value="urgent">Urgent</option>
                    <option value="important">Important</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              )}

              {onSortModeChange && (
                <div className="flex items-center gap-1">
                  <select
                    value={sortMode ?? "date-desc"}
                    onChange={(e) => onSortModeChange(e.target.value as "date-desc" | "priority-desc" | "date-asc")}
                    aria-label="Sort emails"
                    className="h-7 text-xs bg-muted/40 border border-border/60 rounded px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="date-desc">Newest first</option>
                    <option value="priority-desc">Priority (Urgent first)</option>
                    <option value="date-asc">Oldest first</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search Status & Origin Banner */}
      {searchInfo && (
        <div className="bg-muted/40 border-b px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {searchInfo.totalCount} {searchInfo.totalCount === 1 ? "result" : "results"}
            </span>
            <span className="text-muted-foreground">for &ldquo;{searchInfo.query}&rdquo;</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider",
              searchInfo.mode === "hybrid" && "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
              searchInfo.mode === "semantic" && "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
              searchInfo.mode === "keyword" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
            )}>
              {searchInfo.mode} search
            </span>
          </div>

          {searchInfo.stats && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {searchInfo.stats.keywordMatches > 0 && (
                <span>{searchInfo.stats.keywordMatches} keyword</span>
              )}
              {searchInfo.stats.semanticMatches > 0 && (
                <span>{searchInfo.stats.semanticMatches} semantic</span>
              )}
              {searchInfo.stats.hybridMatches > 0 && (
                <span>{searchInfo.stats.hybridMatches} hybrid</span>
              )}
            </div>
          )}
        </div>
      )}

      <ul>
        {emails.map((email) => {
          const isUnread = email.labelIds.includes("UNREAD");
          const isSelected = selectedIds.includes(email.id);
          const cls = classifications?.[email.id];
          const priorityLevel: PriorityType = cls
            ? (cls.priority as PriorityType)
            : isClassifying
              ? "analyzing"
              : "normal";
          const isUrgent = priorityLevel === "urgent";

          return (
            <li
              key={email.id}
              className="border-b"
              onContextMenu={(event) => {
                event.preventDefault();

                setContextMenu({
                  x: Math.max(
                    8,
                    Math.min(event.clientX, window.innerWidth - 220),
                  ),
                  y: Math.max(
                    8,
                    Math.min(event.clientY, window.innerHeight - 260),
                  ),
                  emailId: email.id,
                });
              }}
            >
              <div
                className={cn(
                  "group hover:bg-muted/60 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 px-4 py-3 text-left transition-colors",
                  isUnread && "bg-muted/40",
                  isSelected && "bg-accent/60",
                  selectedId === email.id && "bg-accent",
                  isUrgent && "border-l-3 border-l-rose-500",
                )}
              >
                <div className="flex items-start pt-0.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(email.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${email.subject || "email"}`}
                    className="h-4 w-4 accent-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(email.id)}
                  className="min-w-0 text-left"
                >
                  <span className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "truncate text-sm",
                          isUnread
                            ? "font-semibold text-foreground"
                            : "font-normal text-foreground",
                        )}
                      >
                        {email.from
                          ? formatSender(email.from)
                          : "Unknown sender"}
                      </span>

                      <PriorityBadge
                        priority={priorityLevel}
                        confidence={cls?.confidence}
                        reason={cls?.reason}
                        category={cls?.category}
                        size="sm"
                      />

                      {email.matchOrigin && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded border capitalize font-medium",
                          email.matchOrigin === "hybrid" && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
                          email.matchOrigin === "semantic" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                          email.matchOrigin === "keyword" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                        )}>
                          {email.matchOrigin} match
                        </span>
                      )}
                    </div>

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

                <div className="flex shrink-0 items-start gap-1">
                  {email.date && (
                    <span
                      className={cn(
                        "pt-0.5 text-xs mr-1",
                        isUnread
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatMessageDate(email.date)}
                    </span>
                  )}

                  {isTrashView ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Move to Inbox"
                        title="Move to Inbox"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRestore?.(email.id);
                        }}
                        disabled={Boolean(isRestoring) || isDeleting}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Delete permanently"
                        title="Delete permanently"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(email.id);
                        }}
                        disabled={isDeleting || Boolean(isRestoring)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete email"
                      title="Delete email"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(email.id);
                      }}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
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

          {isTrashView ? (
            <>
              <ContextMenuAction
                icon={<ArchiveRestore className="h-4 w-4" />}
                label="Move to Inbox"
                onClick={() => {
                  setContextMenu(null);
                  onRestore?.(contextEmail.id);
                }}
              />

              <div className="bg-border my-1 h-px" />

              <ContextMenuAction
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete permanently"
                destructive
                onClick={() => {
                  setContextMenu(null);
                  onDelete(contextEmail.id);
                }}
              />
            </>
          ) : (
            <>
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
                  onDelete(contextEmail.id);
                }}
              />
            </>
          )}
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
  classification,
  onOverridePriority,
  onReanalyze,
  isReanalyzing,
  onDelete,
  onRestore,
  onPermanentDelete,
  isDeleting,
  isRestoring,
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
  view: "inbox" | "starred" | "drafts" | "sent" | "trash";
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
  classification?: {
    id: string;
    priority: string;
    confidence: number;
    reason: string;
    category?: string | null;
    userOverride?: boolean;
  };
  onOverridePriority?: (
    messageId: string,
    priority: "urgent" | "important" | "normal" | "low",
  ) => void;
  onReanalyze?: (email: NonNullable<typeof selectedEmail>) => void;
  isReanalyzing?: boolean;
  onDelete?: (messageId: string) => void;
  onRestore?: (messageId: string) => void;
  onPermanentDelete?: (messageId: string) => void;
  isDeleting?: boolean;
  isRestoring?: boolean;
}) {
  const isTrashView = view === "trash";

  return (
    <article className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {view === "trash" ? "Trash" : view}
        </Button>
      </div>

      {isLoading && <StatusLine>Loading message...</StatusLine>}

      {error && <StatusLine tone="error">{error}</StatusLine>}

      {selectedEmail && (
        <div className="bg-card text-card-foreground border-border/80 rounded-lg border p-5 shadow-sm sm:p-6">
          {isTrashView && (
            <div className="bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  This message is in Trash. Messages in Trash are permanently deleted after 30 days.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore?.(selectedEmail.id)}
                  disabled={Boolean(isRestoring) || Boolean(isDeleting)}
                >
                  <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                  Move to Inbox
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onPermanentDelete?.(selectedEmail.id)}
                  disabled={Boolean(isRestoring) || Boolean(isDeleting)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete permanently
                </Button>
              </div>
            </div>
          )}

          {/* AI Priority & Intelligence Card */}
          <div className="mb-5 rounded-lg border border-border/80 bg-muted/20 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Priority:
                </span>
                <PriorityBadge
                  priority={
                    classification
                      ? (classification.priority as PriorityType)
                      : isReanalyzing
                        ? "analyzing"
                        : "normal"
                  }
                  confidence={classification?.confidence}
                  category={classification?.category}
                  size="md"
                />
                {classification?.category && (
                  <span className="text-xs bg-muted border px-2 py-0.5 rounded-full text-foreground font-medium">
                    {classification.category}
                  </span>
                )}
                {classification?.userOverride && (
                  <span className="text-[11px] text-muted-foreground bg-background border px-2 py-0.5 rounded font-medium">
                    User Override
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onOverridePriority && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="hidden sm:inline font-medium">Adjust:</span>
                    <select
                      value={classification?.priority ?? "normal"}
                      onChange={(e) =>
                        onOverridePriority(
                          selectedEmail.id,
                          e.target.value as "urgent" | "important" | "normal" | "low",
                        )
                      }
                      aria-label="Manually adjust priority"
                      className="h-7 text-xs bg-background border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="important">Important</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                )}

                {onReanalyze && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReanalyze(selectedEmail)}
                    disabled={isReanalyzing}
                    className="h-7 text-xs gap-1.5"
                    title="Run fresh AI priority analysis on this email"
                  >
                    <Sparkles
                      className={cn(
                        "h-3 w-3",
                        isReanalyzing && "animate-spin text-primary",
                      )}
                    />
                    <span>{isReanalyzing ? "Analyzing..." : "Re-analyze with AI"}</span>
                  </Button>
                )}
              </div>
            </div>

            {classification?.reason && (
              <div className="mt-3 text-xs text-muted-foreground bg-background/80 rounded-md border border-border/50 p-2.5 leading-relaxed">
                <span className="font-semibold text-foreground">AI Reasoning: </span>
                {classification.reason}
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading min-w-0 text-2xl leading-tight font-semibold">
              {selectedEmail.subject || "(no subject)"}
            </h2>

            {!isTrashView && (
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
            )}
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

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
            {isTrashView ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRestore?.(selectedEmail.id)}
                  disabled={Boolean(isRestoring) || Boolean(isDeleting)}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  Move to Inbox
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onPermanentDelete?.(selectedEmail.id)}
                  disabled={Boolean(isRestoring) || Boolean(isDeleting)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete permanently
                </Button>
              </>
            ) : (
              <>
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

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive ml-auto"
                  onClick={() => onDelete?.(selectedEmail.id)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Move to Trash
                </Button>
              </>
            )}
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

function ActionConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = "default",
  isPending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) {
          onCancel();
        }
      }}
    >
      <section className="bg-card text-card-foreground flex w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            disabled={isPending}
            aria-label="Close"
          >
            ×
          </Button>
        </div>

        <div className="px-5 py-4 text-sm text-muted-foreground">
          <p>{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}

function NotificationToast({
  message,
  subMessage,
  onUndo,
  onClose,
}: {
  message: string;
  subMessage?: string;
  onUndo?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-3 text-sm shadow-xl border border-zinc-800 dark:border-zinc-200 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col">
        <span className="font-medium">{message}</span>
        {subMessage && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {subMessage}
          </span>
        )}
      </div>
      {onUndo && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onUndo();
            onClose();
          }}
          className="h-7 text-xs font-medium ml-1 text-zinc-900 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Undo
        </Button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="text-zinc-400 hover:text-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-900 ml-1.5"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
