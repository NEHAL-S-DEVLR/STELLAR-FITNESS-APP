import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { TRANSFORMATIONS } from "@/lib/transformations";
import { getTrainerBySlug } from "@/lib/trainers";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Transformations | ${GYM_NAME}`,
  description:
    "Real member transformation stories from Stellar Fitness Club — strength gained, weight lost, and habits changed.",
};

export default function TransformationsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Transformations
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Real member results
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Every transformation here started the same way — showing up
          consistently and trusting the program.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-6 lg:grid-cols-2">
        {TRANSFORMATIONS.map((story) => {
          const trainer = getTrainerBySlug(story.trainerSlug);
          return (
            <StaggerItem
              key={story.name}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-8"
            >
              <div className="flex items-center gap-4 overflow-hidden rounded-xl">
                <div className="flex h-24 flex-1 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 to-black text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Before
                </div>
                <div className="flex h-24 flex-1 items-center justify-center rounded-lg bg-gradient-to-br from-blue-900 to-black text-xs font-bold uppercase tracking-wide text-white">
                  After
                </div>
              </div>

              <h2 className="mt-6 text-xl font-bold text-white">
                {story.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
                <span>
                  <span className="text-blue-500 font-semibold">
                    {story.weightChange}
                  </span>
                </span>
                <span>{story.duration}</span>
                <span>{story.program}</span>
              </div>
              <p className="mt-4 text-sm text-zinc-400">{story.story}</p>

              {trainer && (
                <Link
                  href={`/trainers/${trainer.slug}`}
                  className="mt-4 inline-block text-sm font-bold text-blue-500 hover:text-blue-400"
                >
                  Coached by {trainer.name} →
                </Link>
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <Reveal className="mt-16 text-center">
        <h2 className="font-display text-3xl text-white sm:text-4xl">
          Your story could be next
        </h2>
        <div className="mt-6">
          <Link
            href="/enquiry"
            className="inline-block rounded-full bg-blue-600 px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
          >
            Start Your Journey
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
