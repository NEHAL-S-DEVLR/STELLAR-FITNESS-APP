"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Reveal from "@/components/motion/Reveal";

type ApiTrainerDetail = {
  id: number;
  name: string;
  photoUrl: string | null;
  specialization: string | null;
  bio: string | null;
  qualifications: string | null;
  achievements: string | null;
  certificateUrl: string | null;
  instagram: string | null;
  workingHours: { day: string; startTime: string; endTime: string }[];
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function linesOf(text: string | null) {
  return (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function TrainerProfile() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [trainer, setTrainer] = useState<ApiTrainerDetail | null | "not-found">(null);

  useEffect(() => {
    if (!id) {
      setTrainer("not-found");
      return;
    }
    fetch(`/api/public/trainers/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setTrainer)
      .catch(() => setTrainer("not-found"));
  }, [id]);

  if (trainer === null) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="h-10 w-48 animate-pulse rounded bg-zinc-950" />
        <div className="mt-6 h-24 w-24 animate-pulse rounded-full bg-zinc-950" />
      </div>
    );
  }

  if (trainer === "not-found") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="font-display text-4xl text-white">Trainer not found</h1>
        <Link
          href="/trainers"
          className="mt-4 inline-block text-sm font-bold text-blue-500 hover:text-blue-400"
        >
          ← All Trainers
        </Link>
      </div>
    );
  }

  const qualifications = linesOf(trainer.qualifications);
  const achievements = linesOf(trainer.achievements);

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
              {trainer.photoUrl ? (
                <img
                  src={trainer.photoUrl}
                  alt={trainer.name}
                  className="h-24 w-24 shrink-0 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-3xl font-extrabold text-blue-500">
                  {initialsOf(trainer.name)}
                </div>
              )}
              <div>
                <h1 className="font-display text-5xl text-white sm:text-6xl">
                  {trainer.name}
                </h1>
                {trainer.specialization && (
                  <p className="mt-2 text-lg font-semibold text-blue-500">
                    {trainer.specialization}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {trainer.bio && (
              <Reveal>
                <h2 className="text-xl font-bold text-white">About</h2>
                <p className="mt-3 text-zinc-400">{trainer.bio}</p>
              </Reveal>
            )}

            {trainer.certificateUrl && (
              <Reveal delay={0.1} className="mt-10">
                <h2 className="text-xl font-bold text-white">Certificate</h2>
                <a
                  href={trainer.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block max-w-sm overflow-hidden rounded-xl border border-white/10 transition-colors hover:border-blue-500/40"
                >
                  <img
                    src={trainer.certificateUrl}
                    alt={`${trainer.name}'s certificate`}
                    className="w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </a>
              </Reveal>
            )}
          </div>

          <div className="space-y-8">
            {qualifications.length > 0 && (
              <Reveal direction="left">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                  Qualifications
                </h2>
                <ul className="mt-3 space-y-2">
                  {qualifications.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                      <span className="mt-0.5 text-blue-500">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {achievements.length > 0 && (
              <Reveal direction="left" delay={0.1}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                  Achievements
                </h2>
                <ul className="mt-3 space-y-2">
                  {achievements.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                      <span className="mt-0.5 text-blue-500">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {trainer.workingHours.length > 0 && (
              <Reveal direction="left" delay={0.2}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                  Weekly Schedule
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                  {trainer.workingHours.map((s) => (
                    <li key={s.day} className="flex justify-between gap-4">
                      <span>{s.day}</span>
                      <span className="text-zinc-300">
                        {s.startTime}–{s.endTime}
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {trainer.instagram && (
              <Reveal direction="left" delay={0.3}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
                  Instagram
                </h2>
                <p className="mt-3 text-sm text-blue-500">{trainer.instagram}</p>
              </Reveal>
            )}

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
