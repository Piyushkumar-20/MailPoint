"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppSidebar, type AppSection } from "@/app/_components/app-sidebar";
import { AppHeader } from "@/app/_components/app-header";
import { CalendarPanel } from "@/app/_components/calendar-panel";
import { GmailPanel } from "@/app/_components/gmail-panel";
import { authClient } from "@/lib/auth-client";
import { formatWeekLabel, getWeekBounds } from "@/lib/week";

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-6 py-20 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function SettingsPanel({
  user,
  onSignOut,
  isSigningOut,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">Account</h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between border-b border-white/[0.06] pb-3">
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-zinc-200">{user?.name || "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-white/[0.06] pb-3">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{user?.email || "—"}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          className="mt-4 rounded-md border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
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
    <div className="flex h-screen bg-[#0A0A0C] text-zinc-100">
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
                  onCreateEvent: () =>
                    setFocusCreateSignal((n) => n + 1),
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
          {activeSection === "starred" && (
            <EmptyState
              title="Starred isn't wired up yet"
              description="This view needs a starred-messages query on the backend before it can show real data."
            />
          )}
          {activeSection === "sent" && (
            <EmptyState
              title="Sent isn't wired up yet"
              description="This view needs a sent-messages query on the backend before it can show real data."
            />
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
