import { cn } from "@/lib/utils";

/**
 * The page's signature motif: a hairline path with a traveling point of
 * light. It stands in for "your request, moving through the system" and
 * recurs at every place the copy describes a workflow.
 */
export function FlowLine({
  direction = "horizontal",
  className,
  speed = 2.6,
}: {
  direction?: "horizontal" | "vertical";
  className?: string;
  speed?: number;
}) {
  const isHorizontal = direction === "horizontal";
  return (
    <div
      className={cn(
        "relative shrink-0 bg-[repeating-linear-gradient(90deg,color-mix(in_oklch,white,transparent_86%)_0,color-mix(in_oklch,white,transparent_86%)_4px,transparent_4px,transparent_9px)]",
        isHorizontal ? "h-px w-full" : "h-full w-px",
        !isHorizontal &&
          "bg-[repeating-linear-gradient(180deg,color-mix(in_oklch,white,transparent_86%)_0,color-mix(in_oklch,white,transparent_86%)_4px,transparent_4px,transparent_9px)]",
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          "absolute motion-reduce:hidden",
          isHorizontal
            ? "top-1/2 left-0 h-1.5 w-10 -translate-y-1/2 animate-[flow-x_var(--flow-speed)_linear_infinite] bg-gradient-to-r from-transparent via-[#B4A4F0] to-transparent"
            : "top-0 left-1/2 h-10 w-1.5 -translate-x-1/2 animate-[flow-y_var(--flow-speed)_linear_infinite] bg-gradient-to-b from-transparent via-[#B4A4F0] to-transparent",
        )}
        style={{ "--flow-speed": `${speed}s` } as React.CSSProperties}
      />
    </div>
  );
}

export function FlowNode({
  icon,
  label,
  active = false,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-xl border transition-colors",
          active
            ? "border-[#6E56CF]/50 bg-[#6E56CF]/15 text-[#B4A4F0]"
            : "border-white/10 bg-white/[0.03] text-zinc-400",
        )}
      >
        {icon}
      </div>
      <span className="font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
        {label}
      </span>
    </div>
  );
}
