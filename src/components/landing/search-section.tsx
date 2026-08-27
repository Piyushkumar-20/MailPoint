import { Calendar, Mail, MessageSquare, Search } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const RESULTS = [
  {
    icon: Mail,
    source: "Email",
    title: "Backend deployment — quick sync?",
    snippet: "Rahul Mehta · mentions the rollout plan and deploy window.",
  },
  {
    icon: MessageSquare,
    source: "Conversation",
    title: "Thread: Backend deployment plan",
    snippet: "6 messages between you and Rahul over the last two weeks.",
  },
  {
    icon: Calendar,
    source: "Calendar",
    title: "Backend deployment sync",
    snippet: "Tomorrow, 11:00 AM · with Rahul Mehta.",
  },
];

export function SearchSection() {
  return (
    <section className="relative bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="Search"
          title="Search by what you mean."
          description="MailPoint combines traditional keyword search with semantic search, so finding the right message doesn't depend on remembering the exact words in it."
        />

        <Reveal className="mt-12">
          <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#0B0B0F] dark:shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.08] bg-black/[0.01] px-4 py-3 dark:border-white/[0.08] dark:bg-[#0E0E12]">
              <Search className="size-4 shrink-0 text-zinc-400" />
              <span className="font-sans text-[13.5px] text-zinc-800 dark:text-zinc-200">
                Find the conversation where Rahul discussed the backend
                deployment.
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-1.5 p-1">
              {RESULTS.map((result) => (
                <div
                  key={result.title}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-black/[0.04] dark:bg-white/[0.04]">
                    <result.icon className="size-3.5 text-zinc-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {result.title}
                      </span>
                      <span className="text-[9.5px] font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-600">
                        {result.source}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-sans text-[12px] text-zinc-500">
                      {result.snippet}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-[12px] text-zinc-500 dark:text-zinc-500">
            Semantic matching improves as your history with a person or topic
            grows — still evolving, particularly for very old threads.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
