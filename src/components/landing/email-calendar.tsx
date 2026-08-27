import { ArrowRight, Calendar, CheckCircle2, Mail } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

export function EmailCalendar() {
  return (
    <section id="product" className="relative scroll-mt-24 bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Email + Calendar"
          title="One workspace. Two systems. One workflow."
        />

        <Reveal className="mt-14">
          <div className="grid overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_30px_90px_-30px_rgba(0,0,0,0.12)] md:grid-cols-[1fr_auto_1fr] dark:border-white/10 dark:bg-[#0B0B0F] dark:shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            {/* gmail */}
            <div className="flex flex-col p-5">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="size-4 text-zinc-400" />
                <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  Gmail
                </span>
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-black/[0.01] p-4 dark:border-white/[0.06] dark:bg-[#0E0E12]">
                <p className="font-sans text-[12px] text-zinc-500">
                  Rahul Mehta
                </p>
                <p className="mt-1 font-sans text-[13.5px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                  &ldquo;Can we meet tomorrow at 11?&rdquo;
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 font-sans text-[12px] font-medium text-white dark:bg-teal-500"
                >
                  Schedule meeting
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>

            {/* connector */}
            <div className="hidden items-center justify-center px-2 md:flex">
              <div className="h-full w-px bg-black/[0.08] dark:bg-white/[0.08]" />
            </div>

            {/* calendar */}
            <div className="flex flex-col border-t border-black/[0.06] p-5 md:border-t-0 md:border-l dark:border-white/[0.06]">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="size-4 text-zinc-400" />
                <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  Google Calendar
                </span>
              </div>
              <div className="rounded-xl border border-teal-600/20 bg-teal-600/[0.04] p-4 dark:border-teal-400/20 dark:bg-teal-400/[0.04]">
                <p className="font-sans text-[12px] text-zinc-500">
                  Tomorrow · 11:00 – 11:30 AM
                </p>
                <p className="mt-1 font-sans text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">
                  Call with Rahul Mehta
                </p>
                <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-sans text-[12px] text-zinc-800 dark:text-zinc-200">
                    Meeting scheduled
                  </span>
                </div>
              </div>
            </div>

            {/* confirmation footer, spans full width */}
            <div className="col-span-full flex items-center gap-2.5 border-t border-black/[0.06] bg-black/[0.01] px-5 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.015]">
              <Mail className="size-3.5 text-zinc-400" />
              <span className="font-sans text-[12.5px] text-zinc-500">
                Confirmation sent to Rahul Mehta —
              </span>
              <span className="font-sans text-[12.5px] text-zinc-800 dark:text-zinc-200">
                &ldquo;Confirmed for tomorrow at 11 AM. See you then.&rdquo;
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
