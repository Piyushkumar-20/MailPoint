"use client";

import { useState } from "react";
import { Bot, CalendarDays, MailPlus, Plus, Search } from "lucide-react";

import { useActions } from "@/lib/actions/action-context";
import { cn } from "@/lib/utils";

export function MobileQuickActions() {
  const { executeAction, availableActions } = useActions();
  const [isOpen, setIsOpen] = useState(false);

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
  ];

  const contextualActionIds = [
    "mail.reply",
    "mail.forward",
    "mail.star",
    "mail.archive",
  ];

  const activeContextualActions = availableActions.filter((action) =>
    contextualActionIds.includes(action.id),
  );

  const handleActionClick = async (actionId: string) => {
    setIsOpen(false);
    await executeAction(actionId);
  };

  return (
    <div className="fixed right-4 bottom-5 z-40 flex flex-col items-end sm:hidden">
      {isOpen && (
        <div
          className="animate-in fade-in fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {isOpen && (
        <div className="animate-in slide-in-from-bottom-5 relative z-40 mb-3 flex flex-col items-end gap-2.5 duration-200">
          {activeContextualActions.length > 0 && (
            <div className="mb-1 flex w-full flex-col items-end gap-2 border-b border-white/20 pb-2.5">
              <span className="text-muted-foreground px-2 text-[10px] font-semibold tracking-wider uppercase">
                Email Actions
              </span>

              {activeContextualActions.map((action) => {
                const Icon = action.icon ?? Plus;

                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => void handleActionClick(action.id)}
                    className="group flex cursor-pointer items-center gap-2.5"
                  >
                    <span className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1 text-xs font-medium shadow-md">
                      {action.label}
                    </span>

                    <div className="bg-secondary text-secondary-foreground flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105 active:scale-95">
                      <Icon className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {primaryActions.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleActionClick(item.id)}
                className="group flex cursor-pointer items-center gap-2.5"
              >
                <span className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1 text-xs font-medium shadow-md">
                  {item.label}
                </span>

                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95",
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

      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        aria-expanded={isOpen}
        className={cn(
          "bg-primary text-primary-foreground focus:ring-primary relative z-40 flex h-13 w-13 items-center justify-center rounded-full shadow-xl transition-all duration-200 hover:shadow-2xl focus:ring-2 focus:ring-offset-2 focus:outline-none active:scale-95",
          isOpen &&
            "rotate-45 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
        )}
      >
        <Plus className="h-6 w-6 transition-transform" />
      </button>
    </div>
  );
}
