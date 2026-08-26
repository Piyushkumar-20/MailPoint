"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#features", label: "Features" },
  { href: "#technology", label: "Technology" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex justify-center transition-all duration-300",
        scrolled ? "pt-2" : "pt-4",
      )}
    >
      <nav
        className={cn(
          "flex w-[min(100%,68rem)] items-center justify-between rounded-2xl border transition-all duration-300",
          scrolled
            ? "mx-3 border-white/10 bg-[#0A0A0D]/80 px-4 py-2 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur-md"
            : "mx-3 border-transparent bg-transparent px-4 py-3",
        )}
      >
        <Link href="#top" className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-[#6E56CF] text-[11px] font-semibold text-white">
            M
          </span>
          <span className="font-heading text-[15px] font-semibold tracking-tight text-zinc-50">
            MailPoint
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 font-sans text-[13px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 font-sans text-[13px] text-zinc-300 transition-colors hover:text-zinc-50"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-zinc-50 px-3.5 py-1.5 font-sans text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex size-8 items-center justify-center rounded-lg text-zinc-300 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open ? (
        <div className="absolute inset-x-3 top-[calc(100%+0.5rem)] flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0A0A0D]/95 p-3 backdrop-blur-md md:hidden">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 font-sans text-sm text-zinc-300 hover:bg-white/5"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-1 flex flex-col gap-2 border-t border-white/10 pt-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-center font-sans text-sm text-zinc-300 hover:bg-white/5"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-zinc-50 px-3 py-2 text-center font-sans text-sm font-medium text-zinc-950"
            >
              Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
