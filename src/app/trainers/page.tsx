import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import TrainerGrid from "@/components/TrainerGrid";
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

      <div className="mt-12">
        <TrainerGrid />
      </div>
    </div>
  );
}
