"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GYM_NAME, PRIMARY_NAV } from "@/lib/nav";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-white/10 bg-black/90 backdrop-blur"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-2xl text-white"
          onClick={() => setOpen(false)}
        >
          {GYM_NAME.toUpperCase()}
        </Link>

        <nav className="hidden gap-7 lg:flex">
          {PRIMARY_NAV.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold uppercase tracking-wide transition-colors ${
                  active ? "text-blue-500" : "text-zinc-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <a
            href="/login.html"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:text-white"
          >
            Login
          </a>
          <Link
            href="/enquiry"
            className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
          >
            Enquiry
          </Link>
        </div>

        <button
          type="button"
          className="text-zinc-200 lg:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/10 bg-black px-6 py-4 lg:hidden">
          {PRIMARY_NAV.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded px-2 py-2 text-sm font-semibold uppercase tracking-wide ${
                  active ? "text-blue-500" : "text-zinc-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <a
            href="/login.html"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-300 hover:text-white"
          >
            Login
          </a>
          <Link
            href="/enquiry"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-full bg-blue-600 px-5 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-white"
          >
            Enquiry
          </Link>
        </nav>
      )}
    </motion.header>
  );
}
