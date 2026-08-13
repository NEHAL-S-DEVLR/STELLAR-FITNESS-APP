import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { TRAINERS } from "@/lib/trainers";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Trainers | ${GYM_NAME}`,
  description:
    "Meet the certified coaching team at Stellar Fitness Club — strength, conditioning, and group class specialists.",
};

export default function TrainersPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Our Coaches
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Meet the trainers
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Every coach at Stellar is certified, hands-on, and invested in your
          progress — whether you&apos;re lifting for the first time or
          chasing a competition total.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TRAINERS.map((trainer) => (
          <StaggerItem key={trainer.slug}>
            <Link
              href={`/trainers/${trainer.slug}`}
              className="block h-full rounded-2xl border border-white/10 bg-zinc-950 p-6 transition-colors hover:border-blue-500/40"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10 text-lg font-extrabold text-blue-500">
                {trainer.initials}
              </div>
              <h2 className="mt-4 text-lg font-bold text-white">
                {trainer.name}
              </h2>
              <p className="text-sm font-semibold text-blue-500">
                {trainer.role}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                {trainer.specialty}
              </p>
              <p className="mt-3 text-sm text-zinc-400">{trainer.bio}</p>
              <span className="mt-4 inline-block text-sm font-bold text-blue-500">
                View profile →
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}
