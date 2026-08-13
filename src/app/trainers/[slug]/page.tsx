import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/motion/Reveal";
import { getTrainerBySlug, TRAINERS } from "@/lib/trainers";
import { CLASSES } from "@/lib/classes";
import { GYM_NAME } from "@/lib/nav";

export function generateStaticParams() {
  return TRAINERS.map((trainer) => ({ slug: trainer.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trainer = getTrainerBySlug(slug);
  if (!trainer) return {};
  return {
    title: `${trainer.name} | ${GYM_NAME}`,
    description: trainer.bio,
  };
}

export default async function TrainerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trainer = getTrainerBySlug(slug);
  if (!trainer) notFound();

  const classesTaught = CLASSES.filter((c) => c.instructorSlug === slug);

  return (
    <div>
      <section className="border-b border-white/10 bg-black py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <Link
              href="/trainers"
              className="text-sm font-semibold text-zinc-500 hover:text-white"
            >
              ← All Trainers
            </Link>
            <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-3xl font-extrabold text-blue-500">
                {trainer.initials}
              </div>
              <div>
                <h1 className="font-display text-5xl text-white sm:text-6xl">
                  {trainer.name}
                </h1>
                <p className="mt-2 text-lg font-semibold text-blue-500">
                  {trainer.role}
                </p>
                <p className="mt-1 text-sm uppercase tracking-wide text-zinc-500">
                  {trainer.specialty} · {trainer.experience} experience
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Reveal>
              <h2 className="text-xl font-bold text-white">About</h2>
              <p className="mt-3 text-zinc-400">{trainer.bio}</p>
            </Reveal>

            <Reveal delay={0.1} className="mt-10 border-l-2 border-blue-600 pl-6">
              <p className="text-xl font-medium italic text-zinc-200">
                &ldquo;{trainer.philosophy}&rdquo;
              </p>
            </Reveal>

            {classesTaught.length > 0 && (
              <Reveal delay={0.15} className="mt-10">
                <h2 className="text-xl font-bold text-white">
                  Classes taught
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {classesTaught.map((cls) => (
                    <Link
                      key={cls.slug}
                      href={`/classes/${cls.slug}`}
                      className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition-colors hover:border-blue-500/40"
                    >
                      <p className="font-bold text-white">{cls.name}</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {cls.tagline}
                      </p>
                    </Link>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          <div className="space-y-8">
            <Reveal direction="left">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                Certifications
              </h2>
              <ul className="mt-3 space-y-2">
                {trainer.certifications.map((cert) => (
                  <li key={cert} className="flex items-start gap-2 text-sm text-zinc-400">
                    <span className="mt-0.5 text-blue-500">✓</span>
                    {cert}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal direction="left" delay={0.1}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                Achievements
              </h2>
              <ul className="mt-3 space-y-2">
                {trainer.achievements.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                    <span className="mt-0.5 text-blue-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal direction="left" delay={0.2}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                Weekly Schedule
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {trainer.schedule.map((s) => (
                  <li key={s.day} className="flex justify-between gap-4">
                    <span>{s.day}</span>
                    <span className="text-zinc-300">{s.time}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal direction="left" delay={0.3}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                Instagram
              </h2>
              <p className="mt-3 text-sm text-blue-500">{trainer.instagram}</p>
            </Reveal>

            <Reveal direction="left" delay={0.4}>
              <Link
                href="/enquiry"
                className="block rounded-full bg-blue-600 px-6 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
              >
                Book a Session
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
