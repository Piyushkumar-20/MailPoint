import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <span className="font-mono text-[11px] font-medium tracking-[0.16em] text-[#B4A4F0] uppercase">
        {eyebrow}
      </span>
      <h2 className="font-heading max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight text-zinc-50 sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-xl font-sans text-[15px] leading-relaxed text-zinc-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Faint 1px grid, fading toward the edges so it reads as texture, not noise. */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10",
        "[background-image:linear-gradient(to_right,color-mix(in_oklch,white,transparent_95%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,white,transparent_95%)_1px,transparent_1px)]",
        "[background-size:44px_44px]",
        "[mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_40%,transparent_100%)]",
        className,
      )}
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
      {children}
    </span>
  );
}
