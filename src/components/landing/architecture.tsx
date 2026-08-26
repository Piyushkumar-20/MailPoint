import { Calendar, Database, Layers, Mail, Search, Webhook, Zap } from "lucide-react";

import { FlowLine } from "@/components/landing/connector";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const LAYER_1 = ["Next.js", "PostgreSQL", "Corsair"];
const LAYER_2 = ["Gmail", "Google Calendar"];
const LAYER_3 = [
  { label: "AI Agent", icon: Zap },
  { label: "MCP", icon: Layers },
  { label: "Webhooks", icon: Webhook },
  { label: "Semantic Search", icon: Search },
];

export function Architecture() {
  return (
    <section id="technology" className="relative scroll-mt-24 bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="Technology"
          title="Built for connected communication."
          description="MailPoint combines external APIs, OAuth, AI agents, MCP, webhooks, PostgreSQL, and intelligent search into a single communication system."
        />

        <Reveal className="mt-14">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.015] p-8">
            <div className="flex items-center gap-2 rounded-lg border border-[#6E56CF]/30 bg-[#6E56CF]/[0.1] px-4 py-2">
              <span className="flex size-5 items-center justify-center rounded-[5px] bg-[#6E56CF] text-[9px] font-semibold text-white">
                M
              </span>
              <span className="font-heading text-[13px] font-semibold text-zinc-100">
                MailPoint
              </span>
            </div>

            <FlowLine direction="vertical" className="h-8" />

            <div className="flex flex-wrap justify-center gap-2">
              {LAYER_1.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0E0E12] px-3 py-1.5"
                >
                  <Database className="size-3 text-zinc-500" />
                  <span className="font-mono text-[11px] text-zinc-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <FlowLine direction="vertical" className="h-8" />

            <div className="flex flex-wrap justify-center gap-2">
              {LAYER_2.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0E0E12] px-3 py-1.5"
                >
                  {item === "Gmail" ? (
                    <Mail className="size-3 text-zinc-500" />
                  ) : (
                    <Calendar className="size-3 text-zinc-500" />
                  )}
                  <span className="font-mono text-[11px] text-zinc-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <FlowLine direction="vertical" className="h-8" />

            <div className="flex flex-wrap justify-center gap-2">
              {LAYER_3.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0E0E12] px-3 py-1.5"
                >
                  <item.icon className="size-3 text-[#B4A4F0]" />
                  <span className="font-mono text-[11px] text-zinc-300">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
