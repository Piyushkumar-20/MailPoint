import {
  ArrowRight,
  CalendarDays,
  Check,
  Inbox as InboxIcon,
  Search,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";

import { GridBackdrop } from "@/components/landing/section-shell";
import { Reveal } from "@/components/landing/reveal";

const INBOX_ITEMS = [
  {
    name: "Rahul Mehta",
    subject: "Backend deployment — quick sync?",
    preview: "Can we meet tomorrow at 11 to walk through the rollout plan…",
    time: "9:41 AM",
    unread: true,
    active: true,
  },
  {
    name: "Priya Nair",
    subject: "Design review notes",
    preview: "Left a few comments on the onboarding flow, nothing urgent.",
    time: "9:12 AM",
    unread: true,
    active: false,
  },
  {
    name: "Linear",
    subject: "3 issues assigned to you",
    preview: "MP-142, MP-139, and MP-131 were moved to In Progress.",
    time: "8:55 AM",
    unread: false,
    active: false,
  },
  {
    name: "Sam Okafor",
    subject: "Re: Q3 planning doc",
    preview: "Thanks for the update — looks good to move forward.",
    time: "Yesterday",
    unread: false,
    active: false,
  },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[#08080B] pt-36 pb-20 sm:pt-44"
    >
      <GridBackdrop className="h-[900px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-220px] left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#6E56CF]/[0.12] blur-[120px]"
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
        <Reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wide text-zinc-400 uppercase">
            <span className="size-1.5 rounded-full bg-[#34D399]" />
            Now connecting Gmail + Calendar
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-zinc-50 sm:text-6xl">
            Your email and calendar,
            <br />
            finally working as one.
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-6 max-w-xl font-sans text-base leading-relaxed text-zinc-400 sm:text-lg">
            MailPoint brings Gmail, Google Calendar, AI, and intelligent
            search into one communication workspace — so you can focus on
            what you want to accomplish instead of switching between apps.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/register"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-zinc-50 px-5 py-2.5 font-sans text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              Get Started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-2.5 font-sans text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
            >
              See how it works
            </a>
          </div>
        </Reveal>
      </div>

      <Reveal delay={320} className="mt-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="relative rounded-2xl border border-white/10 bg-[#0B0B0F] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]">
            {/* window chrome */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-white/10" />
                <span className="size-2.5 rounded-full bg-white/10" />
                <span className="size-2.5 rounded-full bg-white/10" />
              </div>
              <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-zinc-500">
                <span className="size-1 rounded-full bg-[#34D399]" />
                app.mailpoint.dev
              </div>
            </div>

            <div className="flex">
              {/* icon rail */}
              <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-white/[0.06] py-4 sm:flex">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[#6E56CF] text-[11px] font-semibold text-white">
                  M
                </div>
                <div className="mt-2 flex flex-col gap-3 text-zinc-500">
                  <InboxIcon className="size-4 text-[#B4A4F0]" />
                  <Star className="size-4" />
                  <CalendarDays className="size-4" />
                  <Search className="size-4" />
                  <Settings className="size-4" />
                </div>
              </div>

              {/* inbox list */}
              <div className="hidden w-[280px] shrink-0 flex-col border-r border-white/[0.06] md:flex">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-heading text-[13px] font-semibold text-zinc-100">
                    Inbox
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    2 new
                  </span>
                </div>
                <div className="flex flex-col">
                  {INBOX_ITEMS.map((item) => (
                    <div
                      key={item.subject}
                      className={
                        "flex flex-col gap-1 border-l-2 px-4 py-2.5 " +
                        (item.active
                          ? "border-[#6E56CF] bg-[#6E56CF]/[0.08]"
                          : "border-transparent")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            "truncate font-sans text-[12.5px] " +
                            (item.unread
                              ? "font-semibold text-zinc-100"
                              : "font-medium text-zinc-400")
                          }
                        >
                          {item.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                          {item.time}
                        </span>
                      </div>
                      <span className="truncate font-sans text-[12px] text-zinc-500">
                        {item.subject}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* thread + AI panel */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="border-b border-white/[0.06] px-5 py-3">
                  <p className="font-heading text-[14px] font-semibold text-zinc-100">
                    Backend deployment — quick sync?
                  </p>
                  <p className="mt-0.5 font-sans text-[12px] text-zinc-500">
                    Rahul Mehta · to you
                  </p>
                </div>
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <p className="font-sans text-[13px] leading-relaxed text-zinc-300">
                    Can we meet tomorrow at 11 to walk through the rollout
                    plan and confirm the deploy window?
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-3 bg-white/[0.015] p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-[#6E56CF]/20">
                      <Sparkles className="size-3.5 text-[#B4A4F0]" />
                    </div>
                    <span className="font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
                      Ask MailPoint
                    </span>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-[#0E0E12] px-3 py-2.5 font-sans text-[12.5px] text-zinc-200">
                    Schedule a call with Rahul tomorrow at 11 AM and send a
                    confirmation.
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-[#0E0E12] p-3">
                    {[
                      "Checked your calendar for tomorrow, 11 AM",
                      "Created event · Backend deployment sync",
                      "Sent confirmation to Rahul Mehta",
                    ].map((step) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#34D399]/20">
                          <Check className="size-2.5 text-[#34D399]" />
                        </div>
                        <span className="font-sans text-[12px] text-zinc-400">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between rounded-lg border border-[#6E56CF]/25 bg-[#6E56CF]/[0.08] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 text-[#B4A4F0]" />
                      <span className="font-sans text-[12px] text-zinc-200">
                        Tomorrow, 11:00 AM
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tracking-wide text-[#B4A4F0] uppercase">
                      Confirmed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
