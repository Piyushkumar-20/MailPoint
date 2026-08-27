import { Calendar, Mail, RefreshCw } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const LOG_LINES = [
  { event: "gmail.message.created", detail: "synced to inbox", time: "just now" },
  { event: "calendar.event.updated", detail: "attendee confirmed", time: "12s ago" },
  { event: "gmail.message.replied", detail: "thread refreshed", time: "48s ago" },
];

export function RealtimeSection() {
  return (
    <section className="relative bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="Real-time"
          title="Your workspace stays in sync."
          description="Changes in Gmail or Calendar reach MailPoint the moment they happen, delivered through webhooks handled by Corsair — not on a polling delay."
        />

        <Reveal className="mt-14">
          <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#0B0B0F] dark:shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            <div className="rounded-xl border border-black/[0.06] bg-black/[0.01] p-4 dark:border-white/[0.06] dark:bg-[#0E0E12]">
              <div className="mb-3 flex items-center gap-2 border-b border-black/[0.06] pb-3 dark:border-white/[0.06]">
                <Mail className="size-3.5 text-zinc-400" />
                <span className="font-sans text-[12.5px] text-zinc-600 dark:text-zinc-400">
                  Inbox
                </span>
                <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2 py-0.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    live
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-teal-600/20 bg-teal-600/[0.05] px-3.5 py-2.5 dark:border-teal-400/20 dark:bg-teal-400/[0.05]">
                <Mail className="size-3.5 shrink-0 text-teal-700 dark:text-teal-300" />
                <span className="font-sans text-[12.5px] text-zinc-800 dark:text-zinc-200">
                  New reply from Rahul Mehta
                </span>
                <span className="ml-auto text-[11px] text-zinc-400">
                  just now
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-1.5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
                {LOG_LINES.map((line) => (
                  <div
                    key={line.event}
                    className="flex items-center gap-2 text-[11.5px]"
                  >
                    <RefreshCw className="size-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                    <span className="text-zinc-500 dark:text-zinc-500">
                      {line.event}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-600">
                      · {line.detail}
                    </span>
                    <span className="ml-auto shrink-0 text-zinc-300 dark:text-zinc-700">
                      {line.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100} className="mt-4 flex items-center justify-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-500">
          <Calendar className="size-3.5" />
          Calendar changes reach MailPoint the same way — no refresh required.
        </Reveal>
      </div>
    </section>
  );
}
