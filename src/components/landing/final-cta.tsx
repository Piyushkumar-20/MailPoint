import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#08080B] py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E56CF]/[0.12] blur-[130px]"
      />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <Reveal>
          <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Stop managing communication
            <br />
            one app at a time.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mt-5 max-w-md font-sans text-[15px] leading-relaxed text-zinc-400">
            Bring email, calendar, search, and AI workflows together with
            MailPoint.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/register"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-zinc-50 px-5 py-2.5 font-sans text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              Get Started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#product"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-2.5 font-sans text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
            >
              Explore MailPoint
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
