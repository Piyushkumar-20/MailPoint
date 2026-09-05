"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CalendarDays,
  Command,
  Home,
  Inbox,
  PenSquare,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { AppSidebar, type AppSection } from "@/app/_components/app-sidebar";
import { AppHeader } from "@/app/_components/app-header";
import { AgentPanel } from "@/app/_components/agent/agent-panel";
import {
  CalendarPanel,
  type CalendarEvent,
} from "@/app/_components/calendar-panel";
import { DashboardOverview } from "@/app/_components/dashboard-overview";
import { GmailPanel } from "@/app/_components/gmail-panel";
import { IntegrationsPanel } from "@/app/_components/integrations-panel";
import { CommandPalette } from "@/components/command-palette";
import { MobileQuickActions } from "@/components/mobile-quick-actions";
import { ShortcutsHelpDialog } from "@/components/shortcuts-help-dialog";
import { Button } from "@/components/ui/button";
import { BillingCard } from "@/app/_components/billing-card";
import { ActionProvider, useActions } from "@/lib/actions/action-context";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { formatWeekLabel, getWeekBounds } from "@/lib/week";

const SECTION_PATHS: Record<AppSection, string> = {
  overview: "/dashboard",
  agent: "/agent",
  inbox: "/mail/inbox",
  starred: "/mail/starred",
  drafts: "/mail/drafts",
  sent: "/mail/sent",
  trash: "/mail/trash",
  calendar: "/calendar",
  settings: "/settings",
  integrations: "/settings/integrations",
};

function SettingsPanel({
  user,
  onSignOut,
  isSigningOut,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="space-y-4">
        <div className="bg-card text-card-foreground rounded-lg border p-5">
          <h2 className="mb-4 text-sm font-semibold">Account</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between border-b pb-3">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user?.name ?? "-"}</dd>
            </div>
            <div className="flex justify-between border-b pb-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user?.email ?? "-"}</dd>
            </div>
          </dl>
          <Button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            variant="outline"
            className="mt-4"
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        <BillingCard user={user} />
      </div>
    </div>
  );
}

function MailPointAppInner({
  initialSection = "overview",
}: {
  initialSection?: AppSection;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null;

  const [activeSection, setActiveSection] =
    useState<AppSection>(initialSection);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarFooterHeight, setSidebarFooterHeight] = useState<number | null>(
    null,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Gmail search: lifted here so the header search box can drive GmailPanel.
  const [mailSearchInput, setMailSearchInput] = useState("");
  const [activeMailSearch, setActiveMailSearch] = useState("");
  const [searchMode, setSearchMode] = useState<"hybrid" | "semantic" | "keyword">("hybrid");
  const [searchPriorityFilter, setSearchPriorityFilter] = useState<
    "all" | "urgent" | "important" | "normal" | "low" | "high"
  >("all");

  // Calendar week nav + create signal: lifted here so the header controls
  // CalendarPanel without changing its internal query logic.
  const [weekOffset, setWeekOffset] = useState(0);
  const [focusCreateSignal, setFocusCreateSignal] = useState(0);
  const [calendarComposeRequest, setCalendarComposeRequest] = useState<{
    to: string;
    subject: string;
    body: string;
    requestId: number;
  } | null>(null);
  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const weekLabel = formatWeekLabel(week.start, week.end);
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;

      const section = (Object.entries(SECTION_PATHS).find(
        ([, sectionPath]) => sectionPath === path,
      )?.[0] ?? "overview") as AppSection;

      setActiveSection(section);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
  const handleEmailAttendees = (event: CalendarEvent) => {
    const attendees = Array.from(
      new Set(
        event.attendees
          .map((attendee) => {
            const match = /<([^>]+)>/.exec(attendee);
            return match?.[1] ?? attendee;
          })
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (attendees.length === 0) return;

    setCalendarComposeRequest({
      to: attendees.join(", "),
      subject: event.summary
        ? `Regarding: ${event.summary}`
        : "Regarding your calendar event",
      body: [
        "Hi,",
        "",
        `I’m reaching out regarding "${event.summary || "our calendar event"}".`,
        "",
        event.start
          ? `Scheduled for: ${new Date(event.start).toLocaleString()}`
          : "",
        event.location ? `Location: ${event.location}` : "",
        "",
        "Best,",
      ]
        .filter(Boolean)
        .join("\n"),
      requestId: Date.now(),
    });

    setActiveSection("inbox");
    window.history.pushState({}, "", "/mail/inbox");
  };
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleNavigate = useCallback((section: AppSection) => {
    setActiveSection(section);
    router.push(SECTION_PATHS[section]);
  }, [router]);

  const { registerActions, openCommandPalette, openShortcutsHelp } = useActions();

  // Register Global Navigation, Calendar, AI, and System Actions
  useEffect(() => {
    const unregister = registerActions([
      // Navigation Actions
      {
        id: "nav.inbox",
        label: "Go to Inbox",
        description: "View incoming mail",
        category: "navigation",
        icon: Inbox,
        priority: 90,
        execute: () => handleNavigate("inbox"),
      },
      {
        id: "nav.starred",
        label: "Go to Starred",
        description: "View starred messages",
        category: "navigation",
        icon: Star,
        priority: 85,
        execute: () => handleNavigate("starred"),
      },
      {
        id: "nav.sent",
        label: "Go to Sent",
        description: "View sent emails",
        category: "navigation",
        icon: Send,
        priority: 80,
        execute: () => handleNavigate("sent"),
      },
      {
        id: "nav.drafts",
        label: "Go to Drafts",
        description: "View draft emails",
        category: "navigation",
        icon: PenSquare,
        priority: 75,
        execute: () => handleNavigate("drafts"),
      },
      {
        id: "nav.trash",
        label: "Go to Trash",
        description: "View deleted messages",
        category: "navigation",
        icon: Trash2,
        priority: 70,
        execute: () => handleNavigate("trash"),
      },
      {
        id: "nav.calendar",
        label: "Go to Calendar",
        description: "Open schedule and meetings",
        category: "navigation",
        icon: CalendarDays,
        priority: 88,
        execute: () => handleNavigate("calendar"),
      },
      {
        id: "nav.agent",
        label: "Open MailPoint AI",
        description: "Chat with AI email assistant",
        category: "ai",
        icon: Bot,
        priority: 95,
        mobileVisible: true,
        execute: () => handleNavigate("agent"),
      },
      {
        id: "nav.overview",
        label: "Go to Dashboard Overview",
        description: "Overview metrics and shortcuts",
        category: "navigation",
        icon: Home,
        priority: 60,
        execute: () => handleNavigate("overview"),
      },
      {
        id: "nav.settings",
        label: "Account Settings",
        description: "Manage account and profile",
        category: "navigation",
        icon: Settings,
        priority: 50,
        execute: () => handleNavigate("settings"),
      },

      // Calendar Actions
      {
        id: "calendar.createEvent",
        label: "Create Calendar Event",
        description: "Schedule a new event or meeting",
        category: "calendar",
        icon: CalendarDays,
        shortcut: { key: "c", shift: true, display: "Shift+C" },
        priority: 92,
        mobileVisible: true,
        execute: () => {
          if (activeSection !== "calendar") {
            handleNavigate("calendar");
          }
          setFocusCreateSignal((n) => n + 1);
        },
      },
      {
        id: "calendar.today",
        label: "Today's Schedule",
        description: "Jump to current week",
        category: "calendar",
        isAvailable: () => activeSection === "calendar",
        execute: () => setWeekOffset(0),
      },

      // AI Actions
      {
        id: "ai.ask",
        label: "Ask MailPoint AI",
        description: "Prompt the AI assistant to help you",
        category: "ai",
        icon: Sparkles,
        priority: 96,
        mobileVisible: true,
        execute: () => {
          if (activeSection !== "agent") {
            handleNavigate("agent");
          }
        },
      },

      // Search Action
      {
        id: "mail.search",
        label: "Search Mail",
        description: "Search keywords, senders, or topics",
        category: "mail",
        icon: Search,
        shortcut: { key: "/", ctrlOrCmd: true, display: "⌘/" },
        priority: 85,
        mobileVisible: true,
        execute: () => {
          const isMailSec =
            activeSection === "inbox" ||
            activeSection === "starred" ||
            activeSection === "sent" ||
            activeSection === "trash";
          if (!isMailSec) {
            handleNavigate("inbox");
          }
          setTimeout(() => {
            const input = document.getElementById(
              "mail-search-input",
            ) as HTMLInputElement | null;
            if (input) {
              input.focus();
              input.select();
            } else {
              openCommandPalette();
            }
          }, 60);
        },
      },

      // Help & System
      {
        id: "help.shortcuts",
        label: "Productivity & Shortcuts Help",
        description: "View keyboard shortcuts and touch guide",
        category: "system",
        icon: Command,
        shortcut: { key: "?", display: "?" },
        priority: 40,
        execute: () => openShortcutsHelp(),
      },
    ]);

    return unregister;
  }, [
    registerActions,
    activeSection,
    handleNavigate,
    openCommandPalette,
    openShortcutsHelp,
  ]);

  return (
    <div className="bg-background text-foreground flex h-screen">
      <AppSidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onDesktopFooterHeightChange={setSidebarFooterHeight}
        user={user}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          section={activeSection}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          user={user}
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
          onSettings={() => handleNavigate("settings")}
          mailSearch={
            activeSection === "inbox" ||
            activeSection === "starred" ||
            activeSection === "sent" ||
            activeSection === "trash"
              ? {
                  value: mailSearchInput,
                  onChange: setMailSearchInput,
                  onSubmit: () => setActiveMailSearch(mailSearchInput),
                  onClear: () => {
                    setMailSearchInput("");
                    setActiveMailSearch("");
                  },
                  mode: searchMode,
                  onModeChange: setSearchMode,
                  priorityFilter: searchPriorityFilter,
                  onPriorityFilterChange: setSearchPriorityFilter,
                }
              : undefined
          }
          calendarControls={
            activeSection === "calendar"
              ? {
                  weekLabel,
                  onToday: () => setWeekOffset(0),
                  onPrevWeek: () => setWeekOffset((w) => w - 1),
                  onNextWeek: () => setWeekOffset((w) => w + 1),
                  onCreateEvent: () => setFocusCreateSignal((n) => n + 1),
                  isCurrentWeek: weekOffset === 0,
                }
              : undefined
          }
        />

        <main
          className={cn(
            "min-h-0 flex-1",
            activeSection === "agent" ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {activeSection === "overview" && (
            <DashboardOverview
              userName={user?.name}
              onNavigate={handleNavigate}
            />
          )}
          {activeSection === "agent" && (
            <AgentPanel footerMinHeight={sidebarFooterHeight} />
          )}
          {(activeSection === "inbox" ||
            activeSection === "starred" ||
            activeSection === "sent" ||
            activeSection === "trash" ||
            activeSection === "drafts") && (
            <GmailPanel
              view={activeSection}
              searchQuery={activeMailSearch}
              searchMode={searchMode}
              priorityFilter={searchPriorityFilter}
              onPriorityFilterChange={setSearchPriorityFilter}
              calendarComposeRequest={calendarComposeRequest}
            />
          )}
          {activeSection === "calendar" && (
            <CalendarPanel
              weekOffset={weekOffset}
              focusCreateSignal={focusCreateSignal}
              onEmailAttendees={handleEmailAttendees}
            />
          )}
          {activeSection === "settings" && (
            <SettingsPanel
              user={user}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          )}
          {activeSection === "integrations" && <IntegrationsPanel />}
        </main>
      </div>

      <CommandPalette />
      <MobileQuickActions />
      <ShortcutsHelpDialog />
    </div>
  );
}

export function MailPointApp({
  initialSection = "overview",
}: {
  initialSection?: AppSection;
}) {
  return (
    <ActionProvider>
      <MailPointAppInner initialSection={initialSection} />
    </ActionProvider>
  );
}
