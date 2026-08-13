import Link from "next/link";
import { FOOTER_NAV, GYM_NAME } from "@/lib/nav";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="font-display text-2xl text-white">
            {GYM_NAME.toUpperCase()}
          </p>
          <p className="mt-3 max-w-xs text-sm text-zinc-400">
            Premium strength training, conditioning, and coaching for members
            who want real results.
          </p>
          <p className="mt-6 space-y-1 text-sm text-zinc-400">
            123 Fitness Ave, Suite 100
            <br />
            Bengaluru, KA 560001
            <br />
            (555) 123-4567
          </p>
        </div>

        {Object.entries(FOOTER_NAV).map(([group, links]) => (
          <div key={group}>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              {group}
            </p>
            <ul className="mt-4 space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-400 transition-colors hover:text-blue-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-6 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} {GYM_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
