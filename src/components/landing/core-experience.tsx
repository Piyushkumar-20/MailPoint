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
    <section id="how-it-works" className="relative scroll-mt-24 bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Tell MailPoint what you need."
          description="Describe the outcome in plain language. MailPoint figures out which tools to use and carries it out."
        />

        <Reveal className="mt-14">
          <div className="rounded-2xl border border-white/10 bg-[#0B0B0F] p-2 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            <div className="rounded-xl border border-white/[0.06] bg-[#0E0E12] p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#6E56CF]/20">
                  <Sparkles className="size-4 text-[#B4A4F0]" />
                </div>
                <p className="font-sans text-[15px] leading-relaxed text-zinc-100">
                  &ldquo;Find the email from Rahul about the backend meeting,
                  schedule a call with him tomorrow at 11 AM, and send him a
                  confirmation.&rdquo;
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-white/[0.06] pt-5">
                {STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                      <step.icon className="size-3 text-[#B4A4F0]" />
                      <span className="font-mono text-[10.5px] tracking-wide text-zinc-300 uppercase">
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 ? (
                      <ArrowRight className="size-3 shrink-0 text-zinc-700" />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#34D399]/20 bg-[#34D399]/[0.06] px-3.5 py-2.5">
                <CheckCircle2 className="size-4 text-[#34D399]" />
                <span className="font-sans text-[13px] font-medium text-zinc-100">
                  Workflow completed
                </span>
                <span className="ml-auto font-mono text-[11px] text-zinc-500">
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
