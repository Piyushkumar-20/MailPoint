import { Check, Minus } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const STACK = [
  "Next.js",
  "PostgreSQL",
  "Corsair",
  "Gmail API",
  "Google Calendar API",
  "MCP",
  "Webhooks",
  "Semantic Search",
];

const ROWS: {
  label: string;
  values: [boolean, boolean, boolean | "partial", boolean];
}[] = [
  { label: "Unified inbox and calendar", values: [false, false, false, true] },
  { label: "AI that takes action, not just drafts", values: [false, false, "partial", true] },
  { label: "Semantic search across email and calendar", values: [false, false, false, true] },
  { label: "Real-time sync via webhooks", values: [true, true, "partial", true] },
  { label: "Confirmation before sensitive actions", values: [true, true, "partial", true] },
];

const COLUMNS = ["Gmail alone", "Calendar alone", "AI writing assistant", "MailPoint"];

function Mark({ value }: { value: boolean | "partial" }) {
  if (value === true) {
    return <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (value === "partial") {
    return <span className="mx-auto block text-center text-[11px] text-zinc-400 dark:text-zinc-600">partial</span>;
  }
  return <Minus className="mx-auto size-3.5 text-zinc-300 dark:text-zinc-700" />;
}

export function Architecture() {
  return (
    <section id="technology" className="relative scroll-mt-24 bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="Technology"
          title="Built for connected communication."
          description="MailPoint combines external APIs, OAuth, AI agents, MCP, webhooks, PostgreSQL, and intelligent search into a single communication system."
        />

        <Reveal className="mt-10">
          <div className="flex flex-wrap justify-center gap-2">
            {STACK.map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[12px] font-medium text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300"
              >
                {item}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={100} className="mt-14">
          <p className="mb-4 text-center text-[12px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
            How MailPoint compares
          </p>
          <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-black/[0.02] dark:bg-white/[0.03]">
                  <th className="px-4 py-3 text-[12px] font-medium text-zinc-500 dark:text-zinc-500">
                    &nbsp;
                  </th>
                  {COLUMNS.map((col, i) => (
                    <th
                      key={col}
                      className={
                        "px-3 py-3 text-center text-[11.5px] font-medium " +
                        (i === COLUMNS.length - 1
                          ? "text-teal-700 dark:text-teal-300"
                          : "text-zinc-500 dark:text-zinc-500")
                      }
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, ri) => (
                  <tr
                    key={row.label}
                    className={
                      ri % 2 === 0
                        ? "bg-white dark:bg-[#0B0B0F]"
                        : "bg-black/[0.01] dark:bg-white/[0.015]"
                    }
                  >
                    <td className="px-4 py-3 text-[12.5px] text-zinc-700 dark:text-zinc-300">
                      {row.label}
                    </td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-3 py-3 text-center">
                        <Mark value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-zinc-400 dark:text-zinc-600">
            Generic AI writing assistants can draft replies but typically
            can&apos;t create calendar events or confirm meeting details on
            their own — that&apos;s the gap MailPoint closes.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
