import {
  Calendar,
  CalendarCheck,
  Mail,
  PenLine,
  Search,
  Send,
  Users,
  Zap,
} from "lucide-react";

import { FlowLine, FlowNode } from "@/components/landing/connector";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const CAPABILITIES = [
  { icon: Search, label: "Search email" },
  { icon: PenLine, label: "Draft email" },
  { icon: Send, label: "Send email" },
  { icon: Calendar, label: "Create event" },
  { icon: CalendarCheck, label: "Update event" },
  { icon: Zap, label: "Find availability" },
  { icon: Users, label: "Manage attendees" },
];

export function AiActionLayer() {
  return (
    <section id="features" className="relative scroll-mt-24 bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="AI, applied"
          title="AI that doesn't stop at suggestions."
          description="MailPoint's AI understands natural-language intent and uses controlled tools to carry out Gmail and Calendar operations directly — it's an action layer for your workflow, not just a writing assistant."
        />

        <Reveal className="mt-14">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.015] px-6 py-10 sm:flex-row sm:justify-between">
            <FlowNode icon={<Mail className="size-4" />} label="Request" />
            <FlowLine className="w-10 sm:w-16" />
            <FlowNode
              icon={<Zap className="size-4" />}
              label="AI Agent"
              active
            />
            <FlowLine className="w-10 sm:w-16" />
            <FlowNode
              icon={<Calendar className="size-4" />}
              label="Gmail / Calendar"
            />
            <FlowLine className="w-10 sm:w-16" />
            <FlowNode
              icon={<CalendarCheck className="size-4" />}
              label="Result"
            />
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-6">
          <div className="flex flex-wrap justify-center gap-2.5">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.label}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2"
              >
                <cap.icon className="size-3.5 text-[#B4A4F0]" />
                <span className="font-sans text-[12.5px] text-zinc-300">
                  {cap.label}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
