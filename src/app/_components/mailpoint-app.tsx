"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  LogOutIcon,
  MailIcon,
  PanelLeftIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";

import { CalendarPanel } from "@/app/_components/calendar-panel";
import { GmailPanel } from "@/app/_components/gmail-panel";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function MailPointApp() {
  const router = useRouter();

  const [tab, setTab] = useState<"gmail" | "calendar">("gmail");
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  const navItems = [
    {
      id: "gmail" as const,
      label: "Mail",
      description: "Gmail workspace",
      icon: MailIcon,
    },
    {
      id: "calendar" as const,
      label: "Calendar",
      description: "Schedule and invites",
      icon: CalendarDaysIcon,
    },
  ];

  return (
    <main className="bg-background text-foreground flex min-h-svh">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-72 shrink-0 border-r lg:flex lg:flex-col">
        <div className="border-sidebar-border flex h-16 items-center gap-3 border-b px-5">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <MailIcon className="size-4" />
          </div>
          <div>
            <h1 className="font-heading text-base leading-tight font-semibold">
              MailPoint
            </h1>
            <p className="text-muted-foreground text-xs">
              Gmail + Calendar workspace
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
          <p className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
            Workspace
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-sidebar-border border-t p-3">
          <div className="border-sidebar-border bg-background/35 mb-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SparklesIcon className="text-primary size-4" />
              Connected tools
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              Search, draft, send, schedule, and invite from one focused
              surface.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground w-full justify-start"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOutIcon />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/95 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="border-border bg-card flex size-9 items-center justify-center rounded-lg border lg:hidden">
              <PanelLeftIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                MailPoint
              </p>
              <h2 className="font-heading truncate text-lg font-semibold">
                {tab === "gmail" ? "Gmail workspace" : "Calendar workspace"}
              </h2>
            </div>
          </div>

          <div className="border-border bg-muted/40 text-muted-foreground hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm md:flex">
            <SearchIcon className="size-4" />
            Unified productivity command center
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={tab === item.id ? "default" : "outline"}
                  size="icon"
                  onClick={() => setTab(item.id)}
                  aria-label={item.label}
                >
                  <Icon />
                </Button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-label="Sign out"
            >
              <LogOutIcon />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          {tab === "gmail" ? <GmailPanel /> : <CalendarPanel />}
        </div>
      </section>
    </main>
  );
}
