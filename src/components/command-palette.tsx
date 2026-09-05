"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Calendar,
  ChevronRight,
  Command,
  CornerDownLeft,
  Inbox,
  Mail,
  Search,
  X,
} from "lucide-react";

import { useActions } from "@/lib/actions/action-context";
import type { AppAction, ActionCategory } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

const CATEGORY_METADATA: Record<
  ActionCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  mail: { label: "Email Actions", icon: Mail },
  navigation: { label: "Navigation", icon: Inbox },
  calendar: { label: "Calendar", icon: Calendar },
  ai: { label: "AI Assistant", icon: Bot },
  system: { label: "System & Help", icon: Command },
};

const CATEGORY_ORDER: ActionCategory[] = [
  "mail",
  "navigation",
  "calendar",
  "ai",
  "system",
];

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    availableActions,
    executeAction,
    isMobile,
  } = useActions();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when palette opens
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  // Filter actions based on query
  const filteredActions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Return all available actions sorted by priority/category
      return [...availableActions].sort((a, b) => {
        const pDiff = (b.priority ?? 0) - (a.priority ?? 0);
        if (pDiff !== 0) return pDiff;
        return a.label.localeCompare(b.label);
      });
    }

    return availableActions.filter((action) => {
      if (action.label.toLowerCase().includes(trimmed)) return true;
      if (action.description?.toLowerCase().includes(trimmed)) return true;
      if (action.category.toLowerCase().includes(trimmed)) return true;
      if (action.keywords?.some((k) => k.toLowerCase().includes(trimmed))) return true;
      return false;
    });
  }, [availableActions, query]);

  // Group filtered actions by category
  const groupedActions = useMemo(() => {
    const groups: { category: ActionCategory; actions: AppAction[] }[] = [];

    for (const cat of CATEGORY_ORDER) {
      const items = filteredActions.filter((a) => a.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, actions: items });
      }
    }

    return groups;
  }, [filteredActions]);

  // Flattened array to map selectedIndex to the correct action
  const flatFilteredActions = useMemo(() => {
    return groupedActions.flatMap((g) => g.actions);
  }, [groupedActions]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= flatFilteredActions.length) {
      setSelectedIndex(Math.max(0, flatFilteredActions.length - 1));
    }
  }, [flatFilteredActions.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-action-index="${selectedIndex}"]`,
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleSelectAction = async (action: AppAction) => {
    closeCommandPalette();
    await executeAction(action.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < flatFilteredActions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, flatFilteredActions.length - 1),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const action = flatFilteredActions[selectedIndex];
      if (action) {
        void handleSelectAction(action);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
    }
  };

  if (!isCommandPaletteOpen) return null;

  let flatCounter = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
    >
      <div
        className={cn(
          "bg-popover text-popover-foreground border shadow-2xl flex flex-col overflow-hidden w-full transition-all",
          isMobile
            ? "fixed inset-x-0 bottom-0 top-12 rounded-t-2xl border-b-0 max-h-[calc(100vh-3rem)]"
            : "max-w-2xl rounded-xl max-h-[80vh]",
        )}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3.5 shrink-0 bg-muted/20">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isMobile
                ? "Type a command or action..."
                : "Type a command or search actions... (Esc to close)"
            }
            className="w-full bg-transparent text-sm sm:text-base outline-none placeholder:text-muted-foreground/70"
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={closeCommandPalette}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md sm:hidden"
            aria-label="Close command palette"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 min-h-60 sm:min-h-72 max-h-[60vh] space-y-3"
        >
          {flatFilteredActions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Command className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No actions found</p>
              <p className="text-xs mt-1">Try searching with different keywords.</p>
            </div>
          ) : (
            groupedActions.map((group) => {
              const CategoryMeta = CATEGORY_METADATA[group.category];
              const CatIcon = CategoryMeta.icon;

              return (
                <div key={group.category} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <CatIcon className="h-3 w-3" />
                    <span>{CategoryMeta.label}</span>
                  </div>

                  {group.actions.map((action) => {
                    const currentIndex = flatCounter++;
                    const isSelected = currentIndex === selectedIndex;
                    const ActionIcon = action.icon ?? ChevronRight;

                    return (
                      <button
                        key={action.id}
                        type="button"
                        data-action-index={currentIndex}
                        onClick={() => void handleSelectAction(action)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer",
                          // Touch target sizing: min 44px on touch
                          "min-h-11 sm:min-h-10",
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted/60 text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "p-1.5 rounded-md shrink-0 flex items-center justify-center",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <ActionIcon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {action.label}
                            </div>
                            {action.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {action.description}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Keyboard shortcut or action indicator */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {action.shortcut && !isMobile && (
                            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-muted/80 text-muted-foreground border border-border/80 rounded shadow-xs">
                              {action.shortcut.display}
                            </kbd>
                          )}
                          {isSelected && !isMobile && (
                            <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="border-t px-4 py-2.5 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">
                ↓
              </kbd>
              navigate
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">
                ↵
              </kbd>
              select
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">
                esc
              </kbd>
              close
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground">
            {flatFilteredActions.length}{" "}
            {flatFilteredActions.length === 1 ? "action" : "actions"}
          </span>
        </div>
      </div>
    </div>
  );
}
