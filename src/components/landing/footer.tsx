import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#technology", label: "Technology" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-[#FAFAF9] py-12 dark:border-white/[0.06] dark:bg-[#08080B]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-[6px] bg-zinc-950 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-950">
              M
            </span>
            <span className="font-heading text-[13px] font-semibold text-zinc-800 dark:text-zinc-300">
              MailPoint
            </span>
          </div>
          <p className="max-w-xs font-sans text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-500">
            Gmail, Google Calendar, AI, and search — one communication
            workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-12">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium tracking-[0.1em] text-zinc-400 uppercase dark:text-zinc-600">
              Product
            </p>
            {PRODUCT_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-sans text-[12.5px] text-zinc-600 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium tracking-[0.1em] text-zinc-400 uppercase dark:text-zinc-600">
              Account
            </p>
            <Link
              href="/login"
              className="font-sans text-[12.5px] text-zinc-600 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="font-sans text-[12.5px] text-zinc-600 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center gap-2 border-t border-black/[0.06] px-6 pt-6 sm:flex-row sm:justify-between dark:border-white/[0.06]">
        <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
          © {new Date().getFullYear()} MailPoint
        </p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
          Built with Next.js, PostgreSQL, and Corsair.
        </p>
      </div>
    </footer>
  );
}
