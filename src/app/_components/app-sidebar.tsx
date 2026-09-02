"use client";

import * as React from "react";
import {
  CalendarDays,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Inbox,
  LogOut,
  Mail,
  PenSquare,
  Send,
  Settings,
  Star,
  Trash2,
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
  | "overview"
  | "agent"
  | "inbox"
  | "starred"
  | "drafts"
  | "sent"
  | "trash"
  | "calendar"
  | "settings"
  | "integrations";

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
  { section: "trash", label: "Trash", icon: Trash2 },
];

const DASHBOARD_ITEMS: NavItem[] = [
  { section: "overview", label: "Overview", icon: Home },
  { section: "agent", label: "MailPoint AI", icon: Bot },
];

const CALENDAR_ITEMS: NavItem[] = [
  { section: "calendar", label: "Calendar", icon: CalendarDays },
];

const SETTINGS_ITEMS: NavItem[] = [
  { section: "settings", label: "Account", icon: Settings },
  { section: "integrations", label: "Integrations", icon: Mail },
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
  children: React.ReactElement;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent align={align} className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-foreground truncate text-sm font-medium">
            {user?.name ?? "Signed in"}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {user?.email}
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onSignOut}
          disabled={isSigningOut}
          className="text-destructive focus:text-destructive"
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
        <p className="text-sidebar-foreground/45 px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
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
  onFooterHeightChange,
  user,
  onSignOut,
  isSigningOut,
  showCollapseToggle,
}: {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onFooterHeightChange?: (height: number) => void;
  user: SidebarUser | null;
  onSignOut: () => void;
  isSigningOut: boolean;
  showCollapseToggle: boolean;
}) {
  const footerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!showCollapseToggle || !onFooterHeightChange) return;

    const footer = footerRef.current;

    if (!footer) return;

    const updateFooterHeight = () => {
      const height = Math.ceil(footer.getBoundingClientRect().height);

      if (height > 0) {
        onFooterHeightChange(height);
      }
    };

    updateFooterHeight();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateFooterHeight);

    resizeObserver?.observe(footer);
    window.addEventListener("resize", updateFooterHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFooterHeight);
    };
  }, [onFooterHeightChange, showCollapseToggle]);

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div
        className={cn(
          "border-sidebar-border flex h-14 shrink-0 items-center gap-2 border-b px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="bg-sidebar-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px]">
          <Mail className="text-sidebar-primary-foreground h-3.5 w-3.5" />
        </div>
        {!collapsed && (
          <span className="font-heading text-sm font-semibold">MailPoint</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup
          label="Dashboard"
          items={DASHBOARD_ITEMS}
          activeSection={activeSection}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
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
        <NavGroup
          label="Settings"
          items={SETTINGS_ITEMS}
          activeSection={activeSection}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>

      <div ref={footerRef} className="border-sidebar-border shrink-0 border-t p-2">
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
              "hover:bg-sidebar-accent/70 flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors",
              collapsed && "justify-center",
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={user?.image ?? undefined} alt="" />
              <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs">
                {initialsFor(user)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {user?.name ?? "Account"}
                </p>
                <p className="text-sidebar-foreground/50 truncate text-[11px]">
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
              "text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground mt-1 flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs transition-colors",
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
  onDesktopFooterHeightChange,
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
  onDesktopFooterHeightChange?: (height: number) => void;
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
          "border-sidebar-border hidden shrink-0 border-r transition-[width] duration-150 md:block",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <SidebarBody
          activeSection={activeSection}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onCollapsedChange={onCollapsedChange}
          onFooterHeightChange={onDesktopFooterHeightChange}
          user={user}
          onSignOut={onSignOut}
          isSigningOut={isSigningOut}
          showCollapseToggle
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="border-sidebar-border w-64 p-0">
          <SidebarBody
            activeSection={activeSection}
            onNavigate={(section) => {
              onNavigate(section);
              onMobileOpenChange(false);
            }}
            collapsed={false}
            onCollapsedChange={() => undefined}
            onFooterHeightChange={undefined}
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
