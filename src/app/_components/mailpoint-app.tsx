"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CalendarDays,
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
import { MobileQuickActions } from "@/components/mobile-quick-actions";
import { ActionProvider, useActions } from "@/lib/actions/action-context";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

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

function MailPointAppInner({
  initialSection = "overview",
}: {
  initialSection?: AppSection;
}) {
  const router = useRouter();

  const { data: session } = authClient.useSession();

  const { data: adminStatus } = api.admin.getStatus.useQuery(undefined, {
    enabled: Boolean(session?.user),
    retry: false,
  });

  const isAdmin = adminStatus?.isAdmin === true;

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

  const [searchMode, setSearchMode] = useState<
    "hybrid" | "semantic" | "keyword"
  >("hybrid");

  const [searchPriorityFilter, setSearchPriorityFilter] = useState<
    "all" | "urgent" | "important" | "normal" | "low" | "high"
  >("all");

  // Calendar creation is kept as a small shell-level signal so global
  const [focusCreateSignal, setFocusCreateSignal] = useState(0);
  const [calendarTodaySignal, setCalendarTodaySignal] = useState(0);

  const [calendarComposeRequest, setCalendarComposeRequest] = useState<{
    to: string;
    subject: string;
    body: string;
    requestId: number;
  } | null>(null);

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

  const handleAdminDashboard = () => {
    router.push("/admin");
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

  const handleNavigate = useCallback(
    (section: AppSection) => {
      setActiveSection(section);
      router.push(SECTION_PATHS[section]);
    },
    [router],
  );

  const { registerActions } = useActions();

  const globalActions = useMemo(
    () => [
      // Navigation Actions
      {
        id: "nav.inbox",
        label: "Go to Inbox",
        description: "View incoming mail",
        category: "navigation" as const,
        icon: Inbox,
        priority: 90,
        execute: () => handleNavigate("inbox"),
      },
      {
        id: "nav.starred",
        label: "Go to Starred",
        description: "View starred messages",
        category: "navigation" as const,
        icon: Star,
        priority: 85,
        execute: () => handleNavigate("starred"),
      },
      {
        id: "nav.sent",
        label: "Go to Sent",
        description: "View sent messages",
        category: "navigation" as const,
        icon: Send,
        priority: 80,
        execute: () => handleNavigate("sent"),
      },
      {
        id: "nav.drafts",
        label: "Go to Drafts",
        description: "View draft emails",
        category: "navigation" as const,
        icon: PenSquare,
        priority: 75,
        execute: () => handleNavigate("drafts"),
      },
      {
        id: "nav.trash",
        label: "Go to Trash",
        description: "View deleted messages",
        category: "navigation" as const,
        icon: Trash2,
        priority: 70,
        execute: () => handleNavigate("trash"),
      },
      {
        id: "nav.calendar",
        label: "Go to Calendar",
        description: "Open schedule and meetings",
        category: "navigation" as const,
        icon: CalendarDays,
        priority: 88,
        execute: () => handleNavigate("calendar"),
      },
      {
        id: "nav.agent",
        label: "Open MailPoint AI",
        description: "Chat with AI email assistant",
        category: "ai" as const,
        icon: Bot,
        priority: 95,
        mobileVisible: true,
        execute: () => handleNavigate("agent"),
      },
      {
        id: "nav.overview",
        label: "Go to Dashboard Overview",
        description: "Overview metrics and shortcuts",
        category: "navigation" as const,
        icon: Home,
        priority: 60,
        execute: () => handleNavigate("overview"),
      },
      {
        id: "nav.settings",
        label: "Account Settings",
        description: "Manage account and profile",
        category: "navigation" as const,
        icon: Settings,
        priority: 50,
        execute: () => handleNavigate("settings"),
      },

      // Calendar Actions
      {
        id: "calendar.createEvent",
        label: "Create Calendar Event",
        description: "Schedule a new event or meeting",
        category: "calendar" as const,
        icon: CalendarDays,
        shortcut: {
          key: "c",
          shift: true,
          display: "Shift+C",
        },
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
        category: "calendar" as const,
        isAvailable: () => activeSection === "calendar",
        execute: () => {
          if (activeSection !== "calendar") {
            handleNavigate("calendar");
          }

          setCalendarTodaySignal((n) => n + 1);
        },
      },

      // AI Actions
      {
        id: "ai.ask",
        label: "Ask MailPoint AI",
        description: "Prompt the AI assistant to help you",
        category: "ai" as const,
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
        category: "mail" as const,
        icon: Search,
        shortcut: {
          key: "/",
          ctrlOrCmd: true,
          display: "⌘/",
        },
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
            }
          }, 60);
        },
      },
    ],
    [activeSection, handleNavigate],
  );

  useEffect(() => {
    return registerActions(globalActions);
  }, [registerActions, globalActions]);

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
        onAdmin={handleAdminDashboard}
        isAdmin={isAdmin}
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
          onAdmin={handleAdminDashboard}
          isAdmin={isAdmin}
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
              focusCreateSignal={focusCreateSignal}
              todaySignal={calendarTodaySignal}
              onEmailAttendees={handleEmailAttendees}
            />
          )}

          {(activeSection === "settings" ||
            activeSection === "integrations") && (
            <IntegrationsPanel user={user} />
          )}
        </main>
      </div>
      <MobileQuickActions />
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
