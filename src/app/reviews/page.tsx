import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { REVIEWS } from "@/lib/reviews";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Reviews | ${GYM_NAME}`,
  description: "Read what Stellar Fitness Club members are saying.",
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-blue-500" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "opacity-100" : "opacity-20"}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const average = (
    REVIEWS.reduce((sum, r) => sum + r.rating, 0) / REVIEWS.length
  ).toFixed(1);

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Reviews
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          What members say
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <Stars rating={Math.round(Number(average))} />
          <span className="text-lg font-bold text-white">{average}</span>
          <span className="text-sm text-zinc-500">
            based on {REVIEWS.length} reviews
          </span>
        </div>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((review) => (
          <StaggerItem
            key={review.name}
            className="rounded-2xl border border-white/10 bg-zinc-950 p-6"
          >
            <Stars rating={review.rating} />
            <p className="mt-3 text-sm text-zinc-300">{review.text}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
              <span className="font-semibold text-zinc-300">
                {review.name}
              </span>
              <span>{review.date}</span>
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}
