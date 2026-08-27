import { KeyRound, Lock, ShieldCheck, Webhook } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-shell";

const POINTS = [
  {
    icon: KeyRound,
    title: "Secure Google OAuth",
    description: "You connect Gmail and Calendar through Google's own sign-in flow.",
  },
  {
    icon: Lock,
    title: "Controlled permissions",
    description: "Access is scoped to what a workflow needs, per user and per tenant.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled AI actions",
    description: "Sensitive operations, like sending or inviting, ask for confirmation.",
  },
  {
    icon: Webhook,
    title: "Secure token & webhook handling",
    description: "Credentials and incoming events are handled server-side, not in the browser.",
  },
];

export function Security() {
  return (
    <section className="relative bg-[#FAFAF9] py-24 sm:py-32 dark:bg-[#08080B]">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="Security"
          title="Your communication stays yours."
        />

        <Reveal className="mt-14">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/[0.06] sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.06]">
            {POINTS.map((point) => (
              <div key={point.title} className="bg-white p-6 dark:bg-[#0B0B0F]">
                <point.icon className="size-4 text-teal-700 dark:text-teal-300" />
                <p className="font-heading mt-3 text-[14px] font-semibold text-zinc-950 dark:text-zinc-50">
                  {point.title}
                </p>
                <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-500">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
