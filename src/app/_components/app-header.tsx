"use client";

import { Menu } from "lucide-react";

import {
  AccountMenu,
  type SidebarUser,
  type AppSection,
} from "@/app/_components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchBar, type PriorityFilterOption } from "@/components/search-bar";
import type { SearchMode } from "@/server/lib/email-search";

const SECTION_TITLES: Record<AppSection, string> = {
  overview: "Overview",
  agent: "MailPoint AI",
  inbox: "Inbox",
  starred: "Starred",
  drafts: "Drafts",
  sent: "Sent",
  trash: "Trash",
  calendar: "Calendar",
  settings: "Settings",
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
  return (
    <header className="border-b border-border/70 flex h-[68px] shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-xs sm:flex">
        <span className="font-semibold tracking-tight text-foreground">MailPoint</span>
        <span className="text-muted-foreground/50">/</span>
        <h1 className="truncate text-muted-foreground">{SECTION_TITLES[section]}</h1>
      </div>
      <h1 className="min-w-0 truncate text-sm font-semibold sm:hidden">{SECTION_TITLES[section]}</h1>

      <div className="min-w-0 flex-1" />

      {mailSearch && (
        <div className="hidden w-full max-w-[430px] lg:block">
          <SearchBar
            value={mailSearch.value}
            onChange={mailSearch.onChange}
            onSubmit={mailSearch.onSubmit}
            onClear={mailSearch.onClear}
            mode={mailSearch.mode}
            onModeChange={mailSearch.onModeChange}
            priorityFilter={mailSearch.priorityFilter}
            onPriorityFilterChange={mailSearch.onPriorityFilterChange}
            className="max-w-none"
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
        <button
          type="button"
          aria-label="Open account menu"
          className="shrink-0 rounded-full outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar className="size-9 ring-1 ring-border">
            <AvatarImage src={user?.image ?? undefined} alt="" />
            <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
              {initialsFor(user)}
            </AvatarFallback>
          </Avatar>
        </button>
      </AccountMenu>
    </header>
  );
}
