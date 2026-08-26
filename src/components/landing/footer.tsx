import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#08080B] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-[6px] bg-[#6E56CF] text-[10px] font-semibold text-white">
            M
          </span>
          <span className="font-heading text-[13px] font-semibold text-zinc-300">
            MailPoint
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            href="#product"
            className="font-sans text-[12.5px] text-zinc-500 hover:text-zinc-300"
          >
            Product
          </a>
          <a
            href="#how-it-works"
            className="font-sans text-[12.5px] text-zinc-500 hover:text-zinc-300"
          >
            How it Works
          </a>
          <a
            href="#technology"
            className="font-sans text-[12.5px] text-zinc-500 hover:text-zinc-300"
          >
            Technology
          </a>
          <Link
            href="/login"
            className="font-sans text-[12.5px] text-zinc-500 hover:text-zinc-300"
          >
            Sign In
          </Link>
        </nav>

        <p className="font-mono text-[11px] text-zinc-600">
          © {new Date().getFullYear()} MailPoint
        </p>
      </div>
    </footer>
  );
}
