"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";

type ApiTrainer = {
  id: number;
  name: string;
  photoUrl: string | null;
  specialization: string | null;
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function HomeTrainers() {
  const [trainers, setTrainers] = useState<ApiTrainer[] | null>(null);

  useEffect(() => {
    fetch("/api/public/trainers")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTrainers)
      .catch(() => setTrainers([]));
  }, []);

  if (trainers === null) {
    return (
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (trainers.length === 0) {
    return (
      <p className="mt-12 text-sm text-zinc-500">
        Our coaching team is being added — check back soon.
      </p>
    );
  }

  return (
    <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {trainers.slice(0, 4).map((trainer) => (
        <StaggerItem key={trainer.id}>
          <Link
            href={`/trainers/profile?id=${trainer.id}`}
            className="group block rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500/40"
          >
            {trainer.photoUrl ? (
              <img
                src={trainer.photoUrl}
                alt={trainer.name}
                className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-blue-600/0 transition-all duration-300 group-hover:scale-110 group-hover:ring-blue-500/60"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-lg font-extrabold text-blue-500 ring-2 ring-blue-600/0 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-600/20 group-hover:ring-blue-500/60">
                {initialsOf(trainer.name)}
              </div>
            )}
            <h3 className="mt-4 font-bold text-white">{trainer.name}</h3>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
              {trainer.specialization || "Coach"}
            </p>
          </Link>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
