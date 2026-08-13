import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import Parallax from "@/components/motion/Parallax";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import Marquee from "@/components/Marquee";
import { CLASSES } from "@/lib/classes";
import { TRAINERS } from "@/lib/trainers";
import { REVIEWS } from "@/lib/reviews";

const STATS = [
  { value: 12, suffix: "+", label: "Years Open" },
  { value: 850, suffix: "+", label: "Active Members" },
  { value: 30, suffix: "+", label: "Weekly Classes" },
  { value: 9, suffix: "", label: "Certified Trainers" },
];

const HIGHLIGHTS = [
  {
    title: "Strength Training",
    body: "A full free-weight floor, racks, and competition platforms built for serious lifting.",
  },
  {
    title: "Group Classes",
    body: "HIIT, spin, yoga, boxing, and dance fitness led by certified coaches, every day of the week.",
  },
  {
    title: "Personal Coaching",
    body: "1-on-1 programming and form coaching tailored to your goals and experience level.",
  },
  {
    title: "Open Early & Late",
    body: "5am to 11pm, seven days a week — training that fits your life, not the other way around.",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <section className="relative flex min-h-[92vh] items-center overflow-hidden border-b border-white/10 bg-black">
        <Parallax
          speed={0.4}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="font-display select-none text-[26vw] leading-none text-white/[0.04]">
            STELLAR
          </span>
        </Parallax>

        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-black/60 to-black" />

        <div className="relative mx-auto max-w-6xl px-6 py-32">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-500">
              Stellar Fitness Club — Bengaluru
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display mt-4 max-w-3xl text-6xl leading-[0.95] text-white sm:text-8xl">
              Unleash Your Potential
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-xl text-lg text-zinc-400">
              A premium strength and conditioning gym built for people who
              want real results — heavy weights, honest coaching, and a
              community that shows up.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/enquiry"
                className="rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
              >
                Book Free Trial
              </Link>
              <Link
                href="/membership"
                className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-blue-500 hover:text-blue-500"
              >
                Join Now
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Marquee
        items={[
          "Strength Training",
          "Group Classes",
          "Personal Coaching",
          "Boxing",
          "Yoga & Mobility",
          "Open 5am–11pm",
        ]}
      />

      <section className="border-b border-white/10 bg-black">
        <StaggerGroup className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-16 sm:grid-cols-4">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label} className="text-center sm:text-left">
              <AnimatedCounter
                value={stat.value}
                suffix={stat.suffix}
                className="font-display block text-5xl text-blue-500"
              />
              <p className="mt-2 text-sm text-zinc-400">{stat.label}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
            Why Stellar
          </p>
          <h2 className="font-display mt-3 text-4xl text-white sm:text-5xl">
            Everything you need to train
          </h2>
          <p className="mt-4 max-w-2xl text-zinc-400">
            From your first session to your hundredth, Stellar gives you the
            space, equipment, and coaching to keep progressing.
          </p>
        </Reveal>

        <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((item) => (
            <StaggerItem
              key={item.title}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-6 transition-colors hover:border-blue-500/40"
            >
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{item.body}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="border-y border-white/10 bg-zinc-950 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
                Programs
              </p>
              <h2 className="font-display mt-3 text-4xl text-white sm:text-5xl">
                Find your class
              </h2>
            </div>
            <Link
              href="/classes"
              className="text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-400"
            >
              View all classes →
            </Link>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CLASSES.slice(0, 3).map((cls) => (
              <StaggerItem key={cls.slug}>
                <Link
                  href={`/classes/${cls.slug}`}
                  className="block h-full rounded-2xl border border-white/10 bg-black p-6 transition-colors hover:border-blue-500/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-500">
                    {cls.category}
                  </span>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    {cls.name}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">{cls.tagline}</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
              Coaching Team
            </p>
            <h2 className="font-display mt-3 text-4xl text-white sm:text-5xl">
              Meet the trainers
            </h2>
          </div>
          <Link
            href="/trainers"
            className="text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-400"
          >
            Meet the full team →
          </Link>
        </Reveal>

        <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRAINERS.slice(0, 4).map((trainer) => (
            <StaggerItem key={trainer.slug}>
              <Link
                href={`/trainers/${trainer.slug}`}
                className="block rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center transition-colors hover:border-blue-500/40"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-lg font-extrabold text-blue-500">
                  {trainer.initials}
                </div>
                <h3 className="mt-4 font-bold text-white">{trainer.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                  {trainer.role}
                </p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="border-y border-white/10 bg-zinc-950 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Reveal>
            <p className="text-xl font-medium leading-relaxed text-zinc-200 sm:text-2xl">
              &ldquo;{REVIEWS[0].text}&rdquo;
            </p>
            <p className="mt-6 text-sm font-bold uppercase tracking-wide text-blue-500">
              {REVIEWS[0].name} — Member
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-8">
            <Link
              href="/reviews"
              className="text-sm font-bold uppercase tracking-wide text-zinc-400 hover:text-white"
            >
              Read more reviews →
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-4xl text-white sm:text-5xl">
            Your first class is on us
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Come see the gym, meet the coaches, and try a class free — no
            pressure, no commitment.
          </p>
          <div className="mt-8">
            <Link
              href="/enquiry"
              className="inline-block rounded-full bg-blue-600 px-9 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500"
            >
              Book Your Free Session
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
