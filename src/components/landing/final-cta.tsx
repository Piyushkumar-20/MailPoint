import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAF9] py-28 dark:bg-[#08080B]">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/[0.10] blur-[130px] dark:bg-teal-400/[0.08]"
      />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <Reveal>
          <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
            Stop managing communication
            <br />
            one app at a time.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mt-5 max-w-md font-sans text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Bring email, calendar, search, and AI workflows together with
            MailPoint.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/register"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
            >
              Get Started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#product"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.02] px-5 py-2.5 font-sans text-sm font-medium text-zinc-800 transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
            >
              Explore MailPoint
            </a>
          </div>
        </Reveal>

        <Reveal delay={240} className="mt-10 w-full max-w-sm">
          <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <svg viewBox="0 0 48 48" className="size-4 shrink-0">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.9 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5z" />
            </svg>
            <span className="font-sans text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              Continue with Google
            </span>
            <ArrowRight className="ml-auto size-3.5 text-zinc-400" />
          </div>
          <p className="mt-2 text-[11.5px] text-zinc-400 dark:text-zinc-600">
            Sign in to connect Gmail and Calendar — no setup beforehand.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
