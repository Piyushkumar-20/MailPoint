import { Reveal } from "@/components/landing/reveal";
import { Eyebrow } from "@/components/landing/section-shell";

export function Philosophy() {
  return (
    <section className="relative bg-[#FAFAF9] py-24 sm:py-28 dark:bg-[#08080B]">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <Reveal>
          <Eyebrow>A deliberate choice</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <blockquote className="font-heading mt-5 text-2xl leading-snug font-medium tracking-tight text-zinc-950 sm:text-3xl dark:text-zinc-50">
            &ldquo;Most tools bolt AI onto an inbox. MailPoint starts from the
            workflow — search, scheduling, and messaging as one connected
            system, not three apps that happen to share a login.&rdquo;
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}
