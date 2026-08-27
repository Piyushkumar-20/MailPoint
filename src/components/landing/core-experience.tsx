import { ArrowRight, Calendar, CheckCircle2, Search, Send, Sparkles } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const STEPS = [
  { icon: Search, label: "Search Gmail" },
  { icon: CheckCircle2, label: "Find email" },
  { icon: Calendar, label: "Check Calendar" },
  { icon: Calendar, label: "Find availability" },
  { icon: Calendar, label: "Create event" },
  { icon: Send, label: "Send confirmation" },
];

export function CoreExperience() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Tell MailPoint what you need."
          description="Describe the outcome in plain language. MailPoint figures out which tools to use and carries it out."
        />

        <Reveal className="mt-14">
          <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#0B0B0F] dark:shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            <div className="rounded-xl border border-black/[0.06] bg-black/[0.01] p-5 dark:border-white/[0.06] dark:bg-[#0E0E12]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-600/10 dark:bg-teal-400/15">
                  <Sparkles className="size-4 text-teal-700 dark:text-teal-300" />
                </div>
                <p className="font-sans text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100">
                  &ldquo;Find the email from Rahul about the backend meeting,
                  schedule a call with him tomorrow at 11 AM, and send him a
                  confirmation.&rdquo;
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-black/[0.06] pt-5 dark:border-white/[0.06]">
                {STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                      <step.icon className="size-3 text-teal-700 dark:text-teal-300" />
                      <span className="text-[10.5px] font-medium tracking-wide text-zinc-700 uppercase dark:text-zinc-300">
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 ? (
                      <ArrowRight className="size-3 shrink-0 text-zinc-300 dark:text-zinc-700" />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-sans text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  Workflow completed
                </span>
                <span className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-500">
                  4.2s
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
