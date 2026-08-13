import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `About | ${GYM_NAME}`,
  description:
    "Learn the story behind Stellar Fitness Club, our mission, and what makes our coaching and facility different.",
};

const VALUES = [
  {
    title: "Coaching First",
    body: "Every class and every floor session is led by a certified coach — not just supervised, actually coached.",
  },
  {
    title: "No Ego, No Judgment",
    body: "Whether it's your first rep or your thousandth, Stellar is built to be a place you actually want to walk into.",
  },
  {
    title: "Real Progress",
    body: "We track what matters — strength, consistency, and how you feel — not just how the gym looks on Instagram.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-white/10 bg-black py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
              Our Story
            </p>
            <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
              Built for people who show up
            </h1>
            <p className="mt-6 text-lg text-zinc-400">
              Stellar Fitness Club opened its doors with one goal: build a
              gym where coaching actually matters. No gimmicks, no
              intimidation — just serious equipment, honest programming, and
              a team that knows your name.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal direction="left">
            <h2 className="font-display text-3xl text-white sm:text-4xl">
              From one room to a full facility
            </h2>
            <p className="mt-4 text-zinc-400">
              Stellar started as a single strength-training room with a
              handful of barbells and a small group of dedicated lifters.
              Over 12 years, that room grew into a full facility — a
              free-weight floor, a group class studio, a boxing area, and a
              coaching team of nine certified trainers.
            </p>
            <p className="mt-4 text-zinc-400">
              What hasn&apos;t changed is the philosophy: real coaching,
              honest programming, and a community that pushes each other to
              show up.
            </p>
          </Reveal>
          <Reveal direction="right" delay={0.1}>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
                <p className="font-display text-4xl text-blue-500">2014</p>
                <p className="mt-1 text-sm text-zinc-400">Founded</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
                <p className="font-display text-4xl text-blue-500">850+</p>
                <p className="mt-1 text-sm text-zinc-400">Active members</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
                <p className="font-display text-4xl text-blue-500">9</p>
                <p className="mt-1 text-sm text-zinc-400">Certified coaches</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
                <p className="font-display text-4xl text-blue-500">30+</p>
                <p className="mt-1 text-sm text-zinc-400">Weekly classes</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-white/10 bg-zinc-950 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
              What We Believe
            </p>
            <h2 className="font-display mt-3 text-4xl text-white sm:text-5xl">
              Our values
            </h2>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-3">
            {VALUES.map((value) => (
              <StaggerItem
                key={value.title}
                className="rounded-2xl border border-white/10 bg-black p-6"
              >
                <h3 className="text-lg font-bold text-white">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">{value.body}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-4xl text-white sm:text-5xl">
            Come see it for yourself
          </h2>
          <div className="mt-8">
            <Link
              href="/enquiry"
              className="inline-block rounded-full bg-blue-600 px-9 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
            >
              Book a Free Visit
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
