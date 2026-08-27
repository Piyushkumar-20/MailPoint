import {
  Calendar,
  CheckCircle2,
  Mail,
  MousePointerClick,
  Sparkles,
} from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

export function Problem() {
  return (
    <section className="relative bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="The daily tax"
          title="Ten tabs to answer one email."
          description="A meeting request means opening Gmail, opening Calendar, checking availability by eye, creating the event, then coming back to send a confirmation — by hand, every time."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* before: scattered apps */}
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-black/[0.08] bg-black/[0.015] p-6 dark:border-white/[0.06] dark:bg-white/[0.015]">
              <p className="mb-5 text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
                Without MailPoint
              </p>
              <div className="relative flex flex-1 flex-col items-center justify-center gap-3 py-4">
                {[
                  { icon: Mail, name: "Gmail", note: "reading the request" },
                  {
                    icon: Calendar,
                    name: "Google Calendar",
                    note: "checking availability by eye",
                  },
                  {
                    icon: MousePointerClick,
                    name: "Back to Gmail",
                    note: "typing the confirmation manually",
                  },
                ].map((app, i) => (
                  <div
                    key={app.name}
                    className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-black/[0.08] bg-white/70 px-4 py-3 opacity-90 grayscale-[35%] dark:border-white/[0.08] dark:bg-white/[0.03]"
                    style={{ marginLeft: i % 2 === 0 ? 0 : "1.5rem" }}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] dark:bg-white/[0.06]">
                      <app.icon className="size-4 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-sans text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300">
                        {app.name}
                      </p>
                      <p className="truncate font-sans text-[11px] text-zinc-500">
                        {app.note}
                      </p>
                    </div>
                    <span className="ml-auto text-[9.5px] tracking-wide text-zinc-400 uppercase">
                      tab {i + 1}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center font-sans text-[12px] text-zinc-500">
                Three separate apps, three separate contexts, one simple request.
              </p>
            </div>
          </Reveal>

          {/* after: one unified panel */}
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-2xl border border-teal-600/25 bg-teal-600/[0.04] p-6 dark:border-teal-400/20 dark:bg-teal-400/[0.04]">
              <p className="mb-5 text-[10px] tracking-[0.14em] text-teal-700 uppercase dark:text-teal-300">
                With MailPoint
              </p>
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-black/[0.08] bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#0E0E12]">
                <div className="flex items-center gap-2 border-b border-black/[0.06] pb-3 dark:border-white/[0.06]">
                  <Mail className="size-3.5 text-zinc-400" />
                  <span className="font-sans text-[12px] text-zinc-500">
                    Rahul Mehta — &ldquo;Can we meet tomorrow at 11?&rdquo;
                  </span>
                </div>
                <div className="flex items-center gap-2 py-3">
                  <Sparkles className="size-3.5 text-teal-600 dark:text-teal-300" />
                  <span className="font-sans text-[12px] text-zinc-700 dark:text-zinc-300">
                    MailPoint checked your calendar and created the event.
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-teal-600/20 bg-teal-600/[0.06] px-3 py-2 dark:border-teal-400/20 dark:bg-teal-400/[0.06]">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-teal-700 dark:text-teal-300" />
                    <span className="font-sans text-[12px] text-zinc-800 dark:text-zinc-200">
                      Tomorrow, 11:00 AM
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                      Confirmed
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center font-sans text-[12px] text-zinc-600 dark:text-zinc-400">
                One panel, same request, nothing to switch between.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
