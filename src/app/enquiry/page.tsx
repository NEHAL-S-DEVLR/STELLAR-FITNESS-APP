import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import BookVisitForm from "@/components/BookVisitForm";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Enquiry | ${GYM_NAME}`,
  description:
    "Send us an enquiry at Stellar Fitness Club — tell us your goals, preferred trainer, and which plan interests you, and we'll get back to you.",
};

export default function EnquiryPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Enquiry
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Your first class is free
        </h1>
        <p className="mt-4 text-zinc-400">
          Tell us a bit about your goals and preferred schedule, and
          we&apos;ll get back to you to confirm.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12">
        <BookVisitForm />
      </Reveal>
    </div>
  );
}
