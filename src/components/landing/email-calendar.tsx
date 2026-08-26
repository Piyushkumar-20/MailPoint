import { ArrowRight, Calendar, CheckCircle2, Mail } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

export function EmailCalendar() {
  return (
    <section id="product" className="relative scroll-mt-24 bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Email + Calendar"
          title="One workspace. Two systems. One workflow."
        />

        <Reveal className="mt-14">
          <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0F] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)] md:grid-cols-[1fr_auto_1fr]">
            {/* gmail */}
            <div className="flex flex-col p-5">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="size-4 text-zinc-500" />
                <span className="font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
                  Gmail
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#0E0E12] p-4">
                <p className="font-sans text-[12px] text-zinc-500">
                  Rahul Mehta
                </p>
                <p className="mt-1 font-sans text-[13.5px] leading-relaxed text-zinc-200">
                  &ldquo;Can we meet tomorrow at 11?&rdquo;
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#6E56CF] px-3 py-1.5 font-sans text-[12px] font-medium text-white"
                >
                  Schedule meeting
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>

            {/* connector */}
            <div className="hidden items-center justify-center px-2 md:flex">
              <div className="h-full w-px bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_4px,transparent_4px,transparent_9px)]" />
            </div>

            {/* calendar */}
            <div className="flex flex-col border-t border-white/[0.06] p-5 md:border-t-0 md:border-l">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="size-4 text-zinc-500" />
                <span className="font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
                  Google Calendar
                </span>
              </div>
              <div className="rounded-xl border border-[#6E56CF]/25 bg-[#12101B] p-4">
                <p className="font-sans text-[12px] text-zinc-500">
                  Tomorrow · 11:00 – 11:30 AM
                </p>
                <p className="mt-1 font-sans text-[13.5px] font-medium text-zinc-100">
                  Call with Rahul Mehta
                </p>
                <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#34D399]/[0.08] px-3 py-1.5">
                  <CheckCircle2 className="size-3.5 text-[#34D399]" />
                  <span className="font-sans text-[12px] text-zinc-200">
                    Meeting scheduled
                  </span>
                </div>
              </div>
            </div>

            {/* confirmation footer, spans full width */}
            <div className="col-span-full flex items-center gap-2.5 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3.5">
              <Mail className="size-3.5 text-zinc-500" />
              <span className="font-sans text-[12.5px] text-zinc-400">
                Confirmation sent to Rahul Mehta —
              </span>
              <span className="font-sans text-[12.5px] text-zinc-200">
                &ldquo;Confirmed for tomorrow at 11 AM. See you then.&rdquo;
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
