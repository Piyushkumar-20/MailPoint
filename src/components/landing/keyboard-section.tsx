import { Search } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search" },
  { keys: ["C"], label: "Compose" },
  { keys: ["R"], label: "Reply" },
  { keys: ["E"], label: "Archive" },
  { keys: ["G"], label: "Go to Calendar" },
  { keys: ["A"], label: "Ask MailPoint" },
];

export function KeyboardSection() {
  return (
    <section className="relative bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="Keyboard-first"
          title="Less clicking. More doing."
          description="Every core action in MailPoint has a shortcut, so staying in flow doesn't mean reaching for the mouse."
        />

        <Reveal className="mt-14">
          <div className="rounded-2xl border border-white/10 bg-[#0B0B0F] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
              <Search className="size-3.5 text-zinc-500" />
              <span className="font-sans text-[13px] text-zinc-500">
                Type a command or search…
              </span>
              <div className="ml-auto flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                  ⌘
                </kbd>
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
                  K
                </kbd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
              {SHORTCUTS.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]"
                >
                  <span className="font-sans text-[12.5px] text-zinc-300">
                    {s.label}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="flex size-5 items-center justify-center rounded border border-white/10 bg-white/[0.04] font-mono text-[10px] text-zinc-400"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
