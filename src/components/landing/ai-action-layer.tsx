import {
  Calendar,
  CalendarCheck,
  PenLine,
  Search,
  Send,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const CAPABILITIES = [
  {
    icon: Search,
    title: "Search email",
    description: "Find a message by what it was about, not the exact words in it.",
    replaces: "digging through folders and search operators",
  },
  {
    icon: PenLine,
    title: "Draft email",
    description: "Ask for a reply in your voice, ready to review before it sends.",
    replaces: "staring at a blank compose window",
  },
  {
    icon: Send,
    title: "Send email",
    description: "Sends only after you confirm — nothing goes out unattended.",
    replaces: "a separate send confirmation click",
  },
  {
    icon: Calendar,
    title: "Create event",
    description: "Reads a request like 'tomorrow at 11' and places it correctly.",
    replaces: "opening Calendar to add the event by hand",
  },
  {
    icon: CalendarCheck,
    title: "Update event",
    description: "Reschedules or edits an existing event from a plain-language ask.",
    replaces: "hunting the event down to edit it",
  },
  {
    icon: Zap,
    title: "Find availability",
    description: "Checks your calendar for open time before proposing a slot.",
    replaces: "scanning your week to see what's free",
  },
  {
    icon: Users,
    title: "Manage attendees",
    description: "Adds or removes invitees and keeps the thread in sync.",
    replaces: "a separate 'add guest' step in Calendar",
  },
];

export function AiActionLayer() {
  return (
    <section id="capabilities" className="relative scroll-mt-24 bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="AI that doesn't stop at suggestions."
          description="MailPoint's AI understands natural-language intent and uses controlled tools to carry out Gmail and Calendar operations directly — it's an action layer for your workflow, not just a writing assistant."
        />

        <Reveal className="mt-14">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/[0.06] sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10 dark:bg-white/[0.06]">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="flex flex-col gap-3 bg-white p-6 dark:bg-[#0B0B0F]">
                <div className="flex size-8 items-center justify-center rounded-lg bg-teal-600/10 dark:bg-teal-400/15">
                  <cap.icon className="size-4 text-teal-700 dark:text-teal-300" />
                </div>
                <div>
                  <p className="font-heading text-[14px] font-semibold text-zinc-950 dark:text-zinc-50">
                    {cap.title}
                  </p>
                  <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {cap.description}
                  </p>
                </div>
                <p className="mt-auto text-[11px] text-zinc-400 dark:text-zinc-600">
                  replaces{" "}
                  <span className="text-zinc-500 dark:text-zinc-500">
                    {cap.replaces}
                  </span>
                </p>
              </div>
            ))}
            <div className="flex flex-col items-start justify-center gap-2 bg-teal-600/[0.04] p-6 dark:bg-teal-400/[0.04]">
              <Sparkles className="size-4 text-teal-700 dark:text-teal-300" />
              <p className="font-heading text-[14px] font-semibold text-zinc-950 dark:text-zinc-50">
                Confirmation, always
              </p>
              <p className="font-sans text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Sending a message or inviting an attendee asks first. MailPoint
                acts on your behalf — it doesn&apos;t act instead of you.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
