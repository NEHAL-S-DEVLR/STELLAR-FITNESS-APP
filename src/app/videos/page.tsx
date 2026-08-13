import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { VIDEO_GUIDES } from "@/lib/videos";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Video Guides | ${GYM_NAME}`,
  description:
    "Workout tutorials, machine guides, warmups, stretching, and nutrition videos from the Stellar Fitness Club coaching team.",
};

export default function VideosPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Video Guides
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Learn from the coaches
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Tutorials, machine guides, warmups, stretching, and nutrition
          basics — recorded by the Stellar coaching team.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {VIDEO_GUIDES.map((video) => (
          <StaggerItem
            key={video.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
          >
            <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                {video.duration}
              </span>
            </div>
            <div className="p-5">
              <span className="text-xs font-bold uppercase tracking-wide text-blue-500">
                {video.category}
              </span>
              <h2 className="mt-2 font-bold text-white">{video.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {video.description}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}
