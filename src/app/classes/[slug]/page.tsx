import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/motion/Reveal";
import { CLASSES, getClassBySlug } from "@/lib/classes";
import { getTrainerBySlug } from "@/lib/trainers";
import { GYM_NAME } from "@/lib/nav";

export function generateStaticParams() {
  return CLASSES.map((cls) => ({ slug: cls.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cls = getClassBySlug(slug);
  if (!cls) return {};
  return {
    title: `${cls.name} | ${GYM_NAME}`,
    description: cls.description,
  };
}

export default async function ClassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cls = getClassBySlug(slug);
  if (!cls) notFound();

  const instructor = getTrainerBySlug(cls.instructorSlug);

  return (
    <div>
      <section className="border-b border-white/10 bg-black py-20">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <Link
              href="/classes"
              className="text-sm font-semibold text-zinc-500 hover:text-white"
            >
              ← All Classes
            </Link>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
              {cls.category}
            </p>
            <h1 className="font-display mt-3 text-5xl text-white sm:text-6xl">
              {cls.name}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-zinc-400">
              {cls.tagline}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Reveal>
              <h2 className="text-xl font-bold text-white">Overview</h2>
              <p className="mt-3 text-zinc-400">{cls.description}</p>
            </Reveal>

            <Reveal delay={0.1} className="mt-10">
              <h2 className="text-xl font-bold text-white">Benefits</h2>
              <ul className="mt-4 space-y-2">
                {cls.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-zinc-400">
                    <span className="mt-0.5 text-blue-500">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="space-y-8">
            <Reveal direction="left">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                Details
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li className="flex justify-between gap-4">
                  <span>Duration</span>
                  <span className="text-zinc-300">{cls.duration}</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Level</span>
                  <span className="text-zinc-300">{cls.level}</span>
                </li>
              </ul>
            </Reveal>

            <Reveal direction="left" delay={0.1}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                Schedule
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {cls.schedule.map((s) => (
                  <li key={s.day} className="flex justify-between gap-4">
                    <span>{s.day}</span>
                    <span className="text-zinc-300">{s.time}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {instructor && (
              <Reveal direction="left" delay={0.2}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                  Instructor
                </h2>
                <Link
                  href={`/trainers/${instructor.slug}`}
                  className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950 p-3 transition-colors hover:border-blue-500/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-sm font-extrabold text-blue-500">
                    {instructor.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {instructor.name}
                    </p>
                    <p className="text-xs text-zinc-500">{instructor.role}</p>
                  </div>
                </Link>
              </Reveal>
            )}

            <Reveal direction="left" delay={0.3}>
              <Link
                href="/book-visit"
                className="block rounded-full bg-blue-600 px-6 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
              >
                Join This Class
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
