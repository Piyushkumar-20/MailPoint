import { useMemo } from "react";
import { cn } from "@/lib/utils";

const PALETTES = [
  "bg-violet-600/90 text-white",
  "bg-emerald-600/90 text-white",
  "bg-blue-600/90 text-white",
  "bg-indigo-600/90 text-white",
  "bg-rose-600/90 text-white",
  "bg-amber-600/90 text-white",
  "bg-teal-600/90 text-white",
  "bg-cyan-600/90 text-white",
  "bg-fuchsia-600/90 text-white",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function AgentBrandAvatar({
  name,
  email = "",
  size = "md",
  className,
}: {
  name: string;
  email?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const identifier = `${name} ${email}`.toLowerCase();

  const brandInfo = useMemo(() => {
    if (identifier.includes("mongodb")) {
      return {
        type: "mongodb",
        bg: "bg-[#001E2B] border border-[#00ED64]/30",
      };
    }
    if (identifier.includes("openai") || identifier.includes("chatgpt")) {
      return {
        type: "openai",
        bg: "bg-[#0b1015] border border-white/20",
      };
    }
    if (identifier.includes("devfolio")) {
      return {
        type: "devfolio",
        bg: "bg-black border border-white/20",
      };
    }
    if (identifier.includes("hetrixtools")) {
      return {
        type: "hetrixtools",
        bg: "bg-[#5b32e6] border border-[#7d5bf6]",
      };
    }
    if (identifier.includes("forms") && identifier.includes("google")) {
      return {
        type: "google-forms",
        bg: "bg-white border border-border shadow-xs",
      };
    }
    if (identifier.includes("github")) {
      return {
        type: "github",
        bg: "bg-[#24292e] border border-white/20",
      };
    }
    if (identifier.includes("stripe")) {
      return {
        type: "stripe",
        bg: "bg-[#635bff] border border-white/20",
      };
    }
    return null;
  }, [identifier]);

  const initials = useMemo(() => {
    if (!name || name.toLowerCase() === "unknown") {
      return email ? email.slice(0, 2).toUpperCase() : "?";
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return (name[0] ?? "?").toUpperCase();
  }, [name, email]);

  const colorClass = useMemo(() => {
    const idx = hashString(identifier) % PALETTES.length;
    return PALETTES[idx];
  }, [identifier]);

  const sizeClasses = {
    sm: "size-7 text-[10px]",
    md: "size-9 text-xs",
    lg: "size-10 text-sm",
  }[size];

  if (brandInfo?.type === "mongodb") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full shadow-xs",
          sizeClasses,
          brandInfo.bg,
          className,
        )}
        aria-label="MongoDB"
      >
        <svg viewBox="0 0 24 24" className="size-5 fill-[#00ED64]" aria-hidden="true">
          <path d="M12 2C11.5 2.5 7 7.5 7 13.5C7 17.5 9.5 21 12 22C14.5 21 17 17.5 17 13.5C17 7.5 12.5 2.5 12 2ZM11.6 4.3C11.7 4.1 11.9 4.1 12 4.3C12.4 5.2 15.5 11.8 13.2 16.5C12.6 17.7 11.7 18.7 11.7 18.7C11.7 18.7 11.5 18 11.5 16.5C11.5 15.3 11.7 13.9 11.6 12.8C11.5 11.4 11.2 9.2 11.6 4.3Z" />
        </svg>
      </div>
    );
  }

  if (brandInfo?.type === "openai") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full shadow-xs",
          sizeClasses,
          brandInfo.bg,
          className,
        )}
        aria-label="ChatGPT"
      >
        <svg viewBox="0 0 24 24" className="size-5 fill-white" aria-hidden="true">
          <path d="M22.28 10.55a5.52 5.52 0 0 0-.48-4.57 5.6 5.6 0 0 0-3.92-2.73 5.56 5.56 0 0 0-4.78 1.1A5.55 5.55 0 0 0 8.8 3.5a5.58 5.58 0 0 0-4.32 2.1 5.53 5.53 0 0 0-.85 4.52 5.56 5.56 0 0 0-1.74 3.93 5.54 5.54 0 0 0 1.25 4.43 5.52 5.52 0 0 0 .48 4.57 5.6 5.6 0 0 0 3.92 2.73 5.56 5.56 0 0 0 4.78-1.1 5.55 5.55 0 0 0 4.3 0.85 5.58 5.58 0 0 0 4.32-2.1 5.53 5.53 0 0 0 .85-4.52 5.56 5.56 0 0 0 1.74-3.93 5.54 5.54 0 0 0-1.25-4.43zM12 14.73a2.73 2.73 0 1 1 2.73-2.73A2.73 2.73 0 0 1 12 14.73z" />
        </svg>
      </div>
    );
  }

  if (brandInfo?.type === "devfolio") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-xs",
          sizeClasses,
          brandInfo.bg,
          className,
        )}
        aria-label="Devfolio"
      >
        <span className="font-mono text-base font-black">D</span>
      </div>
    );
  }

  if (brandInfo?.type === "hetrixtools") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-xs",
          sizeClasses,
          brandInfo.bg,
          className,
        )}
        aria-label="HetrixTools"
      >
        <span className="font-heading text-base font-bold">H</span>
      </div>
    );
  }

  if (brandInfo?.type === "google-forms") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full shadow-xs",
          sizeClasses,
          brandInfo.bg,
          className,
        )}
        aria-label="Google Forms"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            fill="#7248B9"
            d="M19.5 3h-15C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5z"
          />
          <path fill="#FFFFFF" d="M7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold uppercase tracking-wider shadow-xs",
        sizeClasses,
        colorClass,
        className,
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
