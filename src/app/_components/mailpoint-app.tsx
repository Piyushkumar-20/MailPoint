"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppSidebar, type AppSection } from "@/app/_components/app-sidebar";
import { AppHeader } from "@/app/_components/app-header";
import { CalendarPanel } from "@/app/_components/calendar-panel";
import { GmailPanel } from "@/app/_components/gmail-panel";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { formatWeekLabel, getWeekBounds } from "@/lib/week";

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-6 py-20 text-center">
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

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
      <div className="bg-card text-card-foreground rounded-lg border p-5">
        <h2 className="mb-4 text-sm font-semibold">Account</h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user?.name || "-"}</dd>
          </div>
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user?.email || "-"}</dd>
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
    </div>
  );
}

export function MailPointApp() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null;

  const [activeSection, setActiveSection] = useState<AppSection>("inbox");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Gmail search: lifted here so the header search box can drive GmailPanel.
  const [mailSearchInput, setMailSearchInput] = useState("");
  const [activeMailSearch, setActiveMailSearch] = useState("");

  // Calendar week nav + create signal: lifted here so the header controls
  // CalendarPanel without changing its internal query logic.
  const [weekOffset, setWeekOffset] = useState(0);
  const [focusCreateSignal, setFocusCreateSignal] = useState(0);
  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const weekLabel = formatWeekLabel(week.start, week.end);

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

  return (
    <div className="bg-background text-foreground flex h-screen">
      <AppSidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
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
          onSettings={() => setActiveSection("settings")}
          mailSearch={
            activeSection === "inbox"
              ? {
                  value: mailSearchInput,
                  onChange: setMailSearchInput,
                  onSubmit: () => setActiveMailSearch(mailSearchInput),
                  onClear: () => {
                    setMailSearchInput("");
                    setActiveMailSearch("");
                  },
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

        <main className="min-h-0 flex-1 overflow-y-auto">
          {activeSection === "inbox" && (
            <GmailPanel view="inbox" searchQuery={activeMailSearch} />
          )}
          {activeSection === "drafts" && (
            <GmailPanel view="drafts" searchQuery={activeMailSearch} />
          )}
          {(activeSection === "inbox" ||
            activeSection === "starred" ||
            activeSection === "sent" ||
            activeSection === "drafts") && (
            <GmailPanel view={activeSection} searchQuery={activeMailSearch} />
          )}
          {activeSection === "calendar" && (
            <CalendarPanel
              weekOffset={weekOffset}
              focusCreateSignal={focusCreateSignal}
            />
          )}
          {activeSection === "settings" && (
            <SettingsPanel
              user={user}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          )}
        </main>
      </div>
    </div>
  );
}
