"use client";

import { Menu } from "lucide-react";

import {
  AccountMenu,
  type SidebarUser,
  type AppSection,
} from "@/app/_components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SECTION_TITLES: Record<AppSection, string> = {
  overview: "Overview",
  agent: "MailPoint AI",
  inbox: "Inbox",
  starred: "Starred",
  drafts: "Drafts",
  sent: "Sent",
  trash: "Trash",
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

import { SearchBar, type PriorityFilterOption } from "@/components/search-bar";
import type { SearchMode } from "@/server/lib/email-search";

interface MailSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  priorityFilter: PriorityFilterOption;
  onPriorityFilterChange: (priority: PriorityFilterOption) => void;
}

export function AppHeader({
  section,
  onOpenMobileSidebar,
  user,
  onSignOut,
  isSigningOut,
  onSettings,
  onAdmin,
  isAdmin,
  mailSearch,
}: {
  section: AppSection;
  onOpenMobileSidebar: () => void;
  user: SidebarUser | null;
  onSignOut: () => void;
  isSigningOut: boolean;
  onSettings: () => void;
  onAdmin: () => void;
  isAdmin: boolean;
  mailSearch?: MailSearchProps;
}) {
  const isMailSection =
    section === "inbox" ||
    section === "starred" ||
    section === "drafts" ||
    section === "sent" ||
    section === "trash";

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
        <div className="hidden w-full max-w-sm sm:block md:max-w-md">
          <SearchBar
            value={mailSearch.value}
            onChange={mailSearch.onChange}
            onSubmit={mailSearch.onSubmit}
            onClear={mailSearch.onClear}
            mode={mailSearch.mode}
            onModeChange={mailSearch.onModeChange}
            priorityFilter={mailSearch.priorityFilter}
            onPriorityFilterChange={mailSearch.onPriorityFilterChange}
          />
        </div>
      )}
      <ModeToggle />

      <AccountMenu
        user={user}
        onSignOut={onSignOut}
        isSigningOut={isSigningOut}
        onSettings={onSettings}
        onAdmin={onAdmin}
        isAdmin={isAdmin}
        triggerId="header-account-menu-trigger"
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
