import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import GalleryGrid from "@/components/GalleryGrid";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Gallery | ${GYM_NAME}`,
  description:
    "Browse photos from Stellar Fitness Club — the gym floor, equipment, classes, events, and member transformations.",
};

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Gallery
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Inside Stellar
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          A look at the gym floor, the classes, the events, and the members
          who make Stellar what it is.
        </p>
      </Reveal>

      <div className="mt-12">
        <GalleryGrid />
      </div>
    </div>
  );
}
