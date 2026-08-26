import {
  ArrowDown,
  Bot,
  Calendar,
  CheckCircle2,
  Mail,
  MailCheck,
  Search,
  Send,
  UserPlus,
} from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const FRAGMENTED_STEPS = [
  { icon: Mail, label: "Email arrives" },
  { icon: Search, label: "Understand request" },
  { icon: Calendar, label: "Open Calendar" },
  { icon: Search, label: "Check availability" },
  { icon: Calendar, label: "Create meeting" },
  { icon: UserPlus, label: "Invite attendee" },
  { icon: Mail, label: "Return to Email" },
  { icon: Send, label: "Send confirmation" },
];

const UNIFIED_STEPS = [
  { icon: Mail, label: "User intent" },
  { icon: Bot, label: "AI" },
  { icon: Calendar, label: "Gmail + Calendar" },
  { icon: CheckCircle2, label: "Completed" },
];

export function Problem() {
  return (
    <section className="relative bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="The problem"
          title="The work doesn't happen inside one app."
          description="A single request — schedule this, confirm that — routinely means eight small handoffs between your inbox and your calendar."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          {/* fragmented */}
          <Reveal>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
              <p className="mb-5 font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
                Without MailPoint
              </p>
              <div className="flex flex-col items-center">
                {FRAGMENTED_STEPS.map((step, i) => (
                  <div key={step.label} className="flex flex-col items-center">
                    <div className="flex w-full max-w-[220px] items-center gap-2.5 rounded-lg border border-white/[0.06] bg-[#0E0E12] px-3 py-2">
                      <step.icon className="size-3.5 shrink-0 text-zinc-500" />
                      <span className="font-sans text-[12.5px] text-zinc-400">
                        {step.label}
                      </span>
                    </div>
                    {i < FRAGMENTED_STEPS.length - 1 ? (
                      <ArrowDown className="my-1 size-3 text-zinc-700" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* transform arrow */}
          <Reveal delay={100} className="flex justify-center lg:flex-col">
            <div className="flex items-center gap-2 rounded-full border border-[#6E56CF]/25 bg-[#6E56CF]/[0.08] px-3 py-1.5 font-mono text-[10px] tracking-wide text-[#B4A4F0] uppercase lg:rotate-90">
              becomes
            </div>
          </Reveal>

          {/* unified */}
          <Reveal delay={160}>
            <div className="rounded-2xl border border-[#6E56CF]/25 bg-[#6E56CF]/[0.06] p-6">
              <p className="mb-5 font-mono text-[10px] tracking-[0.14em] text-[#B4A4F0] uppercase">
                With MailPoint
              </p>
              <div className="flex flex-col items-center">
                {UNIFIED_STEPS.map((step, i) => (
                  <div key={step.label} className="flex flex-col items-center">
                    <div className="flex w-full max-w-[220px] items-center gap-2.5 rounded-lg border border-[#6E56CF]/30 bg-[#12101B] px-3 py-2.5">
                      <step.icon className="size-4 shrink-0 text-[#B4A4F0]" />
                      <span className="font-sans text-[13px] font-medium text-zinc-100">
                        {step.label}
                      </span>
                    </div>
                    {i < UNIFIED_STEPS.length - 1 ? (
                      <ArrowDown className="my-1.5 size-3.5 text-[#6E56CF]/50" />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                <MailCheck className="size-3.5 text-[#34D399]" />
                <span className="font-sans text-[12px] text-zinc-400">
                  One request, no app switching.
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
