import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import BookVisitForm from "@/components/BookVisitForm";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Book a Visit | ${GYM_NAME}`,
  description:
    "Book your free trial class at Stellar Fitness Club — pick a date, time, goal, and preferred trainer.",
};

export default function BookVisitPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Book a Visit
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Your first class is free
        </h1>
        <p className="mt-4 text-zinc-400">
          Tell us a bit about your goals and preferred schedule, and
          we&apos;ll confirm a time that works for you.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12">
        <BookVisitForm />
      </Reveal>
    </div>
  );
}
