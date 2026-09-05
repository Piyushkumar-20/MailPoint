"use client";

import React, { useState } from "react";
import {
  Bot,
  CalendarDays,
  Command,
  MailPlus,
  Plus,
  Search,
} from "lucide-react";

import { useActions } from "@/lib/actions/action-context";
import { cn } from "@/lib/utils";

export function MobileQuickActions() {
  const {
    executeAction,
    openCommandPalette,
    availableActions,
    isCommandPaletteOpen,
    isShortcutsHelpOpen,
  } = useActions();

  const [isOpen, setIsOpen] = useState(false);

  // Don't show FAB if command palette or shortcuts help is active
  if (isCommandPaletteOpen || isShortcutsHelpOpen) return null;

  // Primary mobile actions
  const primaryActions = [
    {
      id: "mail.compose",
      label: "Compose Email",
      icon: MailPlus,
      color: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    {
      id: "calendar.createEvent",
      label: "New Event",
      icon: CalendarDays,
      color: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    {
      id: "ai.ask",
      label: "Ask AI",
      icon: Bot,
      color: "bg-purple-600 hover:bg-purple-700 text-white",
    },
    {
      id: "mail.search",
      label: "Search Mail",
      icon: Search,
      color: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    {
      id: "system.commandPalette",
      label: "Command Palette",
      icon: Command,
      color: "bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900",
      customHandler: () => openCommandPalette(),
    },
  ];

  // Contextual actions available right now (e.g. if an email is currently selected)
  const contextualActionIds = ["mail.reply", "mail.forward", "mail.star", "mail.archive"];
  const activeContextualActions = availableActions.filter((a) =>
    contextualActionIds.includes(a.id),
  );

  const handleActionClick = async (action: (typeof primaryActions)[0]) => {
    setIsOpen(false);
    if (action.customHandler) {
      action.customHandler();
    } else {
      await executeAction(action.id);
    }
  };

  return (
    <div className="fixed right-4 bottom-5 z-40 sm:hidden flex flex-col items-end">
      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 transition-opacity animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Menu Items */}
      {isOpen && (
        <div className="relative z-40 flex flex-col items-end gap-2.5 mb-3 animate-in slide-in-from-bottom-5 duration-200">
          {/* Contextual actions if available (e.g. email open) */}
          {activeContextualActions.length > 0 && (
            <div className="flex flex-col items-end gap-2 mb-1 border-b border-white/20 pb-2.5 w-full">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase px-2">
                Email Actions
              </span>
              {activeContextualActions.map((action) => {
                const Icon = action.icon ?? Plus;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={async () => {
                      setIsOpen(false);
                      await executeAction(action.id);
                    }}
                    className="flex items-center gap-2.5 group cursor-pointer"
                  >
                    <span className="text-xs font-medium bg-popover text-popover-foreground px-2.5 py-1 rounded-md shadow-md border">
                      {action.label}
                    </span>
                    <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground shadow-lg flex items-center justify-center border hover:scale-105 active:scale-95 transition-transform">
                      <Icon className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Primary Quick Actions */}
          {primaryActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleActionClick(item)}
                className="flex items-center gap-2.5 group cursor-pointer"
              >
                <span className="text-xs font-medium bg-popover text-popover-foreground px-2.5 py-1 rounded-md shadow-md border">
                  {item.label}
                </span>
                <div
                  className={cn(
                    "h-11 w-11 rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform",
                    item.color,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        className={cn(
          "relative z-40 h-13 w-13 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isOpen && "rotate-45 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
        )}
      >
        <Plus className="h-6 w-6 transition-transform" />
      </button>
    </div>
  );
}
