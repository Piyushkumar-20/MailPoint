"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Menu, Plus, Search } from "lucide-react";

import { AccountMenu, type SidebarUser, type AppSection } from "@/app/_components/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const SECTION_TITLES: Record<AppSection, string> = {
  inbox: "Inbox",
  starred: "Starred",
  drafts: "Drafts",
  sent: "Sent",
  calendar: "Calendar",
  settings: "Settings",
};

function initialsFor(user: SidebarUser | null) {
  const source = user?.name ?? user?.email ?? "";
  const initials = source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "?";
}

interface MailSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

interface CalendarControlsProps {
  weekLabel: string;
  onToday: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCreateEvent: () => void;
  isCurrentWeek: boolean;
}

export function AppHeader({
  section,
  onOpenMobileSidebar,
  user,
  onSignOut,
  isSigningOut,
  onSettings,
  mailSearch,
  calendarControls,
}: {
  section: AppSection;
  onOpenMobileSidebar: () => void;
  user: SidebarUser | null;
  onSignOut: () => void;
  isSigningOut: boolean;
  onSettings: () => void;
  mailSearch?: MailSearchProps;
  calendarControls?: CalendarControlsProps;
}) {
  const isMailSection =
    section === "inbox" ||
    section === "starred" ||
    section === "drafts" ||
    section === "sent";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0A0A0C] px-3 md:px-4">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-zinc-200 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <h1 className="shrink-0 text-sm font-semibold text-zinc-100">
        {SECTION_TITLES[section]}
      </h1>

      <div className="min-w-0 flex-1" />

      {isMailSection && mailSearch && (
        <form
          className="relative hidden w-full max-w-sm sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            mailSearch.onSubmit();
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={mailSearch.value}
            onChange={(e) => mailSearch.onChange(e.target.value)}
            placeholder="Search mail"
            className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.03] pl-8 pr-8 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6E56CF]/50 focus:outline-none"
          />
          {mailSearch.value && (
            <button
              type="button"
              onClick={mailSearch.onClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </form>
      )}

      {section === "calendar" && calendarControls && (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={calendarControls.onToday}
            disabled={calendarControls.isCurrentWeek}
            className="h-8 border-white/[0.08] bg-transparent text-xs text-zinc-300 hover:bg-white/5"
          >
            Today
          </Button>
          <button
            type="button"
            onClick={calendarControls.onPrevWeek}
            aria-label="Previous week"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={calendarControls.onNextWeek}
            aria-label="Next week"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="hidden px-1 text-xs text-zinc-500 lg:inline">
            {calendarControls.weekLabel}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={calendarControls.onCreateEvent}
            className="h-8 bg-[#6E56CF] text-xs text-white hover:bg-[#7C6BDB]"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      )}

      <AccountMenu
        user={user}
        onSignOut={onSignOut}
        isSigningOut={isSigningOut}
        onSettings={onSettings}
      >
        <button type="button" className="shrink-0 rounded-full">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.image ?? undefined} alt="" />
            <AvatarFallback className="bg-[#6E56CF]/20 text-xs text-[#B4A4F0]">
              {initialsFor(user)}
            </AvatarFallback>
          </Avatar>
        </button>
      </AccountMenu>
    </header>
  );
}
