"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Menu, Plus, Search } from "lucide-react";

import {
  AccountMenu,
  type SidebarUser,
  type AppSection,
} from "@/app/_components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const SECTION_TITLES: Record<AppSection, string> = {
  overview: "Overview",
  agent: "MailPoint AI",
  inbox: "Inbox",
  starred: "Starred",
  drafts: "Drafts",
  sent: "Sent",
  calendar: "Calendar",
  settings: "Account",
  integrations: "Integrations",
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
    <header className="bg-background/95 flex h-14 shrink-0 items-center gap-3 border-b px-3 md:px-4">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden min-w-0 items-baseline gap-2 sm:flex">
        <span className="font-heading text-sm font-semibold">MailPoint</span>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-muted-foreground truncate text-sm font-medium">
          {SECTION_TITLES[section]}
        </h1>
      </div>
      <h1 className="shrink-0 text-sm font-semibold sm:hidden">
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
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={mailSearch.value}
            onChange={(e) => mailSearch.onChange(e.target.value)}
            placeholder="Search mail"
            className="border-input bg-muted/50 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 h-8 w-full rounded-lg border pr-12 pl-8 text-sm focus:ring-3 focus:outline-none"
          />
          {mailSearch.value && (
            <button
              type="button"
              onClick={mailSearch.onClear}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs"
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
            className="h-8 text-xs"
          >
            Today
          </Button>
          <button
            type="button"
            onClick={calendarControls.onPrevWeek}
            aria-label="Previous week"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={calendarControls.onNextWeek}
            aria-label="Next week"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-muted-foreground hidden px-1 text-xs lg:inline">
            {calendarControls.weekLabel}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={calendarControls.onCreateEvent}
            className="h-8 text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      )}

      <ModeToggle />

      <AccountMenu
        user={user}
        onSignOut={onSignOut}
        isSigningOut={isSigningOut}
        onSettings={onSettings}
      >
        <button type="button" className="shrink-0 rounded-full">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.image ?? undefined} alt="" />
            <AvatarFallback className="bg-primary/15 text-primary text-xs">
              {initialsFor(user)}
            </AvatarFallback>
          </Avatar>
        </button>
      </AccountMenu>
    </header>
  );
}
