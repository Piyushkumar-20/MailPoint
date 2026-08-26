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
    <section className="relative bg-[#08080B] py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading
          eyebrow="Security"
          title="Your communication stays yours."
        />

        <Reveal className="mt-14">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] sm:grid-cols-2">
            {POINTS.map((point) => (
              <div key={point.title} className="bg-[#0B0B0F] p-6">
                <point.icon className="size-4 text-[#B4A4F0]" />
                <p className="mt-3 font-heading text-[14px] font-semibold text-zinc-100">
                  {point.title}
                </p>
                <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-zinc-500">
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
