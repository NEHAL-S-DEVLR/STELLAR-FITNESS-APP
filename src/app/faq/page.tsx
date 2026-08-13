import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import FaqAccordion from "@/components/FaqAccordion";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `FAQ | ${GYM_NAME}`,
  description: "Frequently asked questions about Stellar Fitness Club membership, classes, and policies.",
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          FAQ
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Common questions
        </h1>
        <p className="mt-4 text-zinc-400">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link href="/contact" className="font-semibold text-blue-500">
            Reach out directly
          </Link>
          .
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12">
        <FaqAccordion />
      </Reveal>
    </div>
  );
}
