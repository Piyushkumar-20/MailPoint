"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  LogOut,
  Mail,
  PenSquare,
  Send,
  Settings,
  Star,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export type AppSection =
  | "inbox"
  | "starred"
  | "drafts"
  | "sent"
  | "calendar"
  | "settings";

export interface SidebarUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface NavItem {
  section: AppSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIL_ITEMS: NavItem[] = [
  { section: "inbox", label: "Inbox", icon: Inbox },
  { section: "starred", label: "Starred", icon: Star },
  { section: "drafts", label: "Drafts", icon: PenSquare },
  { section: "sent", label: "Sent", icon: Send },
];

const CALENDAR_ITEMS: NavItem[] = [
  { section: "calendar", label: "Calendar", icon: CalendarDays },
];

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

export function AccountMenu({
  user,
  onSignOut,
  isSigningOut,
  onSettings,
  align = "end",
  children,
}: {
  user: SidebarUser | null;
  onSignOut: () => void;
  isSigningOut: boolean;
  onSettings: () => void;
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-zinc-100">
            {user?.name || "Signed in"}
          </p>
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onSignOut}
          disabled={isSigningOut}
          className="text-red-400 focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavGroup({
  label,
  items,
  activeSection,
  collapsed,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  activeSection: AppSection;
  collapsed: boolean;
  onNavigate: (section: AppSection) => void;
}) {
  return (
    <div>
      {!collapsed && (
        <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold tracking-wider text-zinc-600">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.section;
          return (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigate(item.section)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-[#6E56CF]/15 text-[#B4A4F0]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarBody({
  activeSection,
  onNavigate,
  collapsed,
  onCollapsedChange,
  user,
  onSignOut,
  isSigningOut,
  showCollapseToggle,
}: {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  user: SidebarUser | null;
  onSignOut: () => void;
  isSigningOut: boolean;
  showCollapseToggle: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-[#0D0D10]">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[#6E56CF]">
          <Mail className="h-3.5 w-3.5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-zinc-100">
            MailPoint
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup
          label="Mail"
          items={MAIL_ITEMS}
          activeSection={activeSection}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <NavGroup
          label="Calendar"
          items={CALENDAR_ITEMS}
          activeSection={activeSection}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />

        <div className="mt-4 border-t border-white/[0.06] pt-2">
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              collapsed && "justify-center px-0",
              activeSection === "settings"
                ? "bg-[#6E56CF]/15 text-[#B4A4F0]"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <AccountMenu
          user={user}
          onSignOut={onSignOut}
          isSigningOut={isSigningOut}
          onSettings={() => onNavigate("settings")}
          align="start"
        >
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-white/5",
              collapsed && "justify-center",
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={user?.image ?? undefined} alt="" />
              <AvatarFallback className="bg-[#6E56CF]/20 text-xs text-[#B4A4F0]">
                {initialsFor(user)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">
                  {user?.name || "Account"}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {user?.email}
                </p>
              </div>
            )}
          </button>
        </AccountMenu>

        {showCollapseToggle && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              "mt-1 flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({
  activeSection,
  onNavigate,
  collapsed,
  onCollapsedChange,
  user,
  onSignOut,
  isSigningOut,
  mobileOpen,
  onMobileOpenChange,
}: {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  user: SidebarUser | null;
  onSignOut: () => void;
  isSigningOut: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-white/[0.06] transition-[width] duration-150 md:block",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <SidebarBody
          activeSection={activeSection}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onCollapsedChange={onCollapsedChange}
          user={user}
          onSignOut={onSignOut}
          isSigningOut={isSigningOut}
          showCollapseToggle
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 border-white/[0.06] p-0">
          <SidebarBody
            activeSection={activeSection}
            onNavigate={(section) => {
              onNavigate(section);
              onMobileOpenChange(false);
            }}
            collapsed={false}
            onCollapsedChange={() => undefined}
            user={user}
            onSignOut={onSignOut}
            isSigningOut={isSigningOut}
            showCollapseToggle={false}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
