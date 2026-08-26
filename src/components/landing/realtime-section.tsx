import { Calendar, Mail, Radio, Webhook, Wifi } from "lucide-react";

import { FlowLine, FlowNode } from "@/components/landing/connector";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

export function RealtimeSection() {
  return (
    <section className="relative bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="Real-time"
          title="Your workspace stays in sync."
          description="Changes in Gmail or Calendar reach MailPoint the moment they happen, through webhooks handled by Corsair — not on a polling delay."
        />

        <Reveal className="mt-14">
          <div className="rounded-2xl border border-white/10 bg-white/[0.015] px-6 py-10">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <FlowNode
                icon={<Mail className="size-4" />}
                label="Gmail / Calendar"
              />
              <FlowLine className="w-10 sm:w-14" />
              <FlowNode icon={<Webhook className="size-4" />} label="Corsair" active />
              <FlowLine className="w-10 sm:w-14" />
              <FlowNode icon={<Radio className="size-4" />} label="Webhook" />
              <FlowLine className="w-10 sm:w-14" />
              <FlowNode icon={<Wifi className="size-4" />} label="MailPoint" />
              <FlowLine className="w-10 sm:w-14" />
              <FlowNode
                icon={<Calendar className="size-4" />}
                label="UI"
              />
            </div>

            <div className="mx-auto mt-8 flex max-w-sm items-center gap-2.5 rounded-lg border border-[#34D399]/20 bg-[#34D399]/[0.06] px-3.5 py-2.5">
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-[#34D399]" />
              <span className="font-sans text-[12.5px] text-zinc-200">
                New reply from Rahul Mehta — just now
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
