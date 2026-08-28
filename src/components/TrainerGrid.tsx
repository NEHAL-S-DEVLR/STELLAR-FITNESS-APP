"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";

type ApiTrainer = {
  id: number;
  name: string;
  photoUrl: string | null;
  specialization: string | null;
  bio: string | null;
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TrainerGrid({ limit }: { limit?: number }) {
  const [trainers, setTrainers] = useState<ApiTrainer[] | null>(null);

  useEffect(() => {
    fetch("/api/public/trainers")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTrainers)
      .catch(() => setTrainers([]));
  }, []);

  const items = trainers === null ? null : limit ? trainers.slice(0, limit) : trainers;

  if (items === null) {
    return (
      <div className={`grid gap-6 sm:grid-cols-2 ${limit ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {Array.from({ length: limit || 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Our coaching team is being added — check back soon.
      </p>
    );
  }

  return (
    <StaggerGroup className={`grid gap-6 sm:grid-cols-2 ${limit ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {items.map((trainer) => (
        <StaggerItem key={trainer.id}>
          <Link
            href={`/trainers/profile?id=${trainer.id}`}
            className={`group block h-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 transition-colors hover:border-blue-500/40 ${limit ? "p-6 text-center" : "p-6"}`}
          >
            {trainer.photoUrl ? (
              <img
                src={trainer.photoUrl}
                alt={trainer.name}
                className={`rounded-full object-cover ${limit ? "mx-auto h-16 w-16" : "h-14 w-14"}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                className={`flex items-center justify-center rounded-full bg-blue-600/10 font-extrabold text-blue-500 ${limit ? "mx-auto h-16 w-16 text-lg" : "h-14 w-14 text-lg"}`}
              >
                {initialsOf(trainer.name)}
              </div>
            )}
            <h3 className="mt-4 font-bold text-white">{trainer.name}</h3>
            {trainer.specialization && (
              <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                {trainer.specialization}
              </p>
            )}
            {!limit && trainer.bio && (
              <p className="mt-3 line-clamp-3 text-sm text-zinc-400">{trainer.bio}</p>
            )}
            <span className="mt-4 inline-block text-sm font-bold text-blue-500 group-hover:text-blue-400">
              View profile →
            </span>
          </Link>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
