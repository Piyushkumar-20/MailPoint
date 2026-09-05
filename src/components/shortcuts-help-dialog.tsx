"use client";

import {
  Calendar,
  Command,
  Inbox,
  Keyboard,
  Mail,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useActions } from "@/lib/actions/action-context";

export function ShortcutsHelpDialog() {
  const { isShortcutsHelpOpen, closeShortcutsHelp, isMobile } = useActions();

  if (!isShortcutsHelpOpen) {
    return null;
  }

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs duration-150 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isMobile ? "Mobile Productivity Guide" : "Keyboard Shortcuts"}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeShortcutsHelp();
        }
      }}
    >
      <div className="bg-card text-card-foreground flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="bg-muted/20 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 text-primary rounded-lg p-1.5">
              {isMobile ? (
                <Smartphone className="h-5 w-5" />
              ) : (
                <Keyboard className="h-5 w-5" />
              )}
            </div>

            <div>
              <h2 className="text-base font-semibold">
                {isMobile
                  ? "MailPoint Touch & Quick Actions"
                  : "Keyboard Shortcuts"}
              </h2>

              <p className="text-muted-foreground text-xs">
                {isMobile
                  ? "Productivity features optimized for your touch device"
                  : "Boost your workflow with fast keyboard commands"}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={closeShortcutsHelp}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 text-sm">
          {isMobile ? (
            /* Mobile Guide */
            <div className="space-y-4">
              <div className="bg-muted/20 space-y-2 rounded-lg border p-3.5">
                <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <div className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                    +
                  </div>
                  Floating Quick Action Button (FAB)
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Tap the floating <strong>+</strong> button in the bottom right
                  corner on any screen to immediately Compose an Email, Create a
                  Calendar Event, Ask MailPoint AI, or Search.
                </p>
              </div>

              <div className="bg-muted/20 space-y-2 rounded-lg border p-3.5">
                <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Command className="text-primary h-4 w-4" />
                  Mobile Command Palette
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Tap the <strong>⌘</strong> command icon in the top header to
                  open the touch-friendly Command Palette. Search any feature,
                  navigation destination, or tool instantly.
                </p>
              </div>

              <div className="bg-muted/20 space-y-2 rounded-lg border p-3.5">
                <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Mail className="text-primary h-4 w-4" />
                  Email Touch Actions
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Tap any email to read. While reading, contextual buttons for
                  Reply, Forward, Star, and Move to Trash are always within
                  thumb reach.
                </p>
              </div>

              <div className="bg-muted/20 space-y-2 rounded-lg border p-3.5">
                <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="text-primary h-4 w-4" />
                  Smart Priority & Hybrid Search
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Use the Priority dropdown to filter Urgent or Important
                  emails. The search bar supports keyword, semantic, and hybrid
                  AI search.
                </p>
              </div>
            </div>
          ) : (
            /* Desktop Keyboard Shortcuts */
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Global Shortcuts */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Command className="h-3.5 w-3.5" />
                  Global
                </h3>

                <div className="space-y-2 text-xs">
                  <ShortcutRow keys={["⌘", "K"]} label="Open Command Palette" />
                  <ShortcutRow keys={["⌘", "/"]} label="Focus Search Bar" />
                  <ShortcutRow keys={["?"]} label="Show Keyboard Shortcuts" />
                  <ShortcutRow
                    keys={["Esc"]}
                    label="Close modal / palette / menu"
                  />
                </div>
              </div>

              {/* Email Actions */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Mail className="h-3.5 w-3.5" />
                  Email Actions
                </h3>

                <div className="space-y-2 text-xs">
                  <ShortcutRow keys={["C"]} label="Compose new email" />
                  <ShortcutRow keys={["R"]} label="Reply to current email" />
                  <ShortcutRow keys={["F"]} label="Forward current email" />
                  <ShortcutRow keys={["E"]} label="Move to Trash / Archive" />
                  <ShortcutRow keys={["S"]} label="Toggle Star" />
                  <ShortcutRow keys={["Shift", "I"]} label="Mark as read" />
                  <ShortcutRow keys={["Shift", "U"]} label="Mark as unread" />
                </div>
              </div>

              {/* Email List Navigation */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Inbox className="h-3.5 w-3.5" />
                  List Navigation
                </h3>

                <div className="space-y-2 text-xs">
                  <ShortcutRow keys={["J"]} label="Next email in list" />
                  <ShortcutRow keys={["K"]} label="Previous email in list" />
                  <ShortcutRow
                    keys={["Enter", "or", "O"]}
                    label="Open selected email"
                  />
                  <ShortcutRow keys={["U"]} label="Back to email list" />
                </div>
              </div>

              {/* Navigation & Sections */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Calendar className="h-3.5 w-3.5" />
                  Apps & Calendar
                </h3>

                <div className="space-y-2 text-xs">
                  <ShortcutRow
                    keys={["Shift", "C"]}
                    label="Create calendar event"
                  />
                  <ShortcutRow keys={["G", "C"]} label="Go to Calendar" />
                  <ShortcutRow keys={["G", "I"]} label="Go to Inbox" />
                  <ShortcutRow keys={["G", "A"]} label="Go to MailPoint AI" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-muted/20 text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-xs">
          <span>MailPoint Productivity Layer</span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={closeShortcutsHelp}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="border-border/40 flex items-center justify-between border-b py-1">
      <span className="text-foreground">{label}</span>

      <div className="flex items-center gap-1">
        {keys.map((key, index) =>
          key === "or" ? (
            <span
              key={`${key}-${index}`}
              className="text-muted-foreground px-0.5 text-[10px]"
            >
              or
            </span>
          ) : (
            <kbd
              key={`${key}-${index}`}
              className="bg-muted text-foreground rounded border px-2 py-0.5 font-mono text-[11px] font-medium shadow-xs"
            >
              {key}
            </kbd>
          ),
        )}
      </div>
    </div>
  );
}
