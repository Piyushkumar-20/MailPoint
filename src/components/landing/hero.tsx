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
    time: "9:41 AM",
    unread: true,
    active: true,
  },
  {
    name: "Priya Nair",
    subject: "Design review notes",
    time: "9:12 AM",
    unread: true,
    active: false,
  },
  {
    name: "Linear",
    subject: "3 issues assigned to you",
    time: "8:55 AM",
    unread: false,
    active: false,
  },
  {
    name: "Sam Okafor",
    subject: "Re: Q3 planning doc",
    time: "Yesterday",
    unread: false,
    active: false,
  },
];

const STATS = [
  { value: "1", label: "inbox for email, calendar, and search" },
  { value: "8 → 2", label: "steps to turn a request into a meeting" },
  { value: "0", label: "tabs to switch to send a confirmation" },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[#FAFAF9] pt-36 pb-20 sm:pt-44 dark:bg-[#08080B]"
    >
      <GridBackdrop className="h-[900px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-220px] left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-teal-500/[0.10] blur-[120px] dark:bg-teal-400/[0.08]"
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
        <Reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-[11px] tracking-wide text-zinc-600 uppercase dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Now connecting Gmail + Calendar
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-zinc-950 sm:text-6xl dark:text-zinc-50">
            Your email and calendar,
            <br />
            finally working as one.
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-6 max-w-xl font-sans text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
            MailPoint brings Gmail, Google Calendar, AI, and intelligent
            search into one communication workspace — so you can focus on
            what you want to accomplish instead of switching between apps.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/register"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
            >
              Get Started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.02] px-5 py-2.5 font-sans text-sm font-medium text-zinc-800 transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
            >
              See how it works
            </a>
          </div>
        </Reveal>

        <Reveal delay={300}>
          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-black/10 pt-8 dark:border-white/10">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <span className="font-heading text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-zinc-50">
                  {stat.value}
                </span>
                <span className="max-w-[9rem] font-sans text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-500">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <Reveal delay={360} className="mt-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="relative rounded-2xl border border-black/10 bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.15)] dark:border-white/10 dark:bg-[#0B0B0F] dark:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]">
            {/* window chrome */}
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-black/10 dark:bg-white/10" />
                <span className="size-2.5 rounded-full bg-black/10 dark:bg-white/10" />
                <span className="size-2.5 rounded-full bg-black/10 dark:bg-white/10" />
              </div>
              <div className="mx-auto flex items-center gap-1.5 rounded-md bg-black/[0.03] px-3 py-1 text-[11px] text-zinc-500 dark:bg-white/[0.03]">
                <span className="size-1 rounded-full bg-emerald-500" />
                app.mailpoint.dev
              </div>
            </div>

            <div className="flex">
              {/* icon rail */}
              <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-black/[0.06] py-4 sm:flex dark:border-white/[0.06]">
                <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-950">
                  M
                </div>
                <div className="mt-2 flex flex-col gap-3 text-zinc-400 dark:text-zinc-500">
                  <InboxIcon className="size-4 text-teal-600 dark:text-teal-300" />
                  <Star className="size-4" />
                  <CalendarDays className="size-4" />
                  <Search className="size-4" />
                  <Settings className="size-4" />
                </div>
              </div>

              {/* inbox list */}
              <div className="hidden w-[280px] shrink-0 flex-col border-r border-black/[0.06] md:flex dark:border-white/[0.06]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-heading text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Inbox
                  </span>
                  <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
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
                          ? "border-teal-600 bg-teal-600/[0.06] dark:border-teal-400 dark:bg-teal-400/[0.08]"
                          : "border-transparent")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            "truncate font-sans text-[12.5px] " +
                            (item.unread
                              ? "font-semibold text-zinc-900 dark:text-zinc-100"
                              : "font-medium text-zinc-500 dark:text-zinc-400")
                          }
                        >
                          {item.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                          {item.time}
                        </span>
                      </div>
                      <span className="truncate font-sans text-[12px] text-zinc-500 dark:text-zinc-500">
                        {item.subject}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* thread + AI panel */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
                  <p className="font-heading text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Backend deployment — quick sync?
                  </p>
                  <p className="mt-0.5 font-sans text-[12px] text-zinc-500">
                    Rahul Mehta · to you
                  </p>
                </div>
                <div className="border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.06]">
                  <p className="font-sans text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                    Can we meet tomorrow at 11 to walk through the rollout
                    plan and confirm the deploy window?
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-3 bg-black/[0.01] p-4 dark:bg-white/[0.015]">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-teal-600/10 dark:bg-teal-400/15">
                      <Sparkles className="size-3.5 text-teal-700 dark:text-teal-300" />
                    </div>
                    <span className="text-[10px] tracking-wide text-zinc-500 uppercase">
                      Ask MailPoint
                    </span>
                  </div>

                  <div className="rounded-lg border border-black/[0.06] bg-white px-3 py-2.5 font-sans text-[12.5px] text-zinc-800 dark:border-white/[0.06] dark:bg-[#0E0E12] dark:text-zinc-200">
                    Schedule a call with Rahul tomorrow at 11 AM and send a
                    confirmation.
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border border-black/[0.06] bg-white p-3 dark:border-white/[0.06] dark:bg-[#0E0E12]">
                    {[
                      "Checked your calendar for tomorrow, 11 AM",
                      "Created event · Backend deployment sync",
                      "Sent confirmation to Rahul Mehta",
                    ].map((step) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                          <Check className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="font-sans text-[12px] text-zinc-600 dark:text-zinc-400">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between rounded-lg border border-teal-600/20 bg-teal-600/[0.06] px-3 py-2 dark:border-teal-400/20 dark:bg-teal-400/[0.06]">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 text-teal-700 dark:text-teal-300" />
                      <span className="font-sans text-[12px] text-zinc-800 dark:text-zinc-200">
                        Tomorrow, 11:00 AM
                      </span>
                    </div>
                    <span className="text-[10px] tracking-wide text-teal-700 uppercase dark:text-teal-300">
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
