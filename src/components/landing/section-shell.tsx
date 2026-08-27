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
        align === "center"
          ? "items-center text-center"
          : "items-start text-left",
        className,
      )}
    >
      <span className="text-[11px] font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
        {eyebrow}
      </span>
      <h2 className="font-heading max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-xl font-sans text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400",
            align === "center" ? "mx-auto" : "",
          )}
        >
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
        "[background-image:linear-gradient(to_right,color-mix(in_oklch,currentColor,transparent_95%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,currentColor,transparent_95%)_1px,transparent_1px)]",
        "[background-size:44px_44px]",
        "text-zinc-950 dark:text-white",
        "[mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_40%,transparent_100%)]",
        className,
      )}
    />
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-[0.16em] text-teal-700 uppercase dark:text-teal-300">
      {children}
    </span>
  );
}
