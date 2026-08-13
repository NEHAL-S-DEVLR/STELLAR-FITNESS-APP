import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { CLASSES } from "@/lib/classes";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Classes | ${GYM_NAME}`,
  description:
    "Browse the full class schedule at Stellar Fitness Club, including HIIT, strength, spin, yoga, boxing, and dance fitness.",
};

export default function ClassesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Programs
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Find your class
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Every class is included with an Unlimited or Coached membership.
          Drop in whenever it fits your schedule.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CLASSES.map((cls) => (
          <StaggerItem key={cls.slug}>
            <Link
              href={`/classes/${cls.slug}`}
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-zinc-950 p-6 transition-colors hover:border-blue-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-blue-500">
                  {cls.category}
                </span>
                <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-300">
                  {cls.level}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-white">
                {cls.name}
              </h2>
              <p className="mt-2 flex-1 text-sm text-zinc-400">
                {cls.tagline}
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm text-zinc-400">
                {cls.duration} · {cls.schedule[0].day}
              </div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}
