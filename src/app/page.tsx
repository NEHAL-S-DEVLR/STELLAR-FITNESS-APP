import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import Parallax from "@/components/motion/Parallax";
import HeroHeadline from "@/components/motion/HeroHeadline";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import AnimatedCounter from "@/components/motion/AnimatedCounter";
import Marquee from "@/components/Marquee";
import PhotoMarquee from "@/components/PhotoMarquee";
import HomeTrainers from "@/components/HomeTrainers";
import { CLASSES } from "@/lib/classes";
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

const MARQUEE_PHOTOS = [
  "cable-crossover-tower.jpg",
  "cardio-bike.jpg",
  "cardio-floor-wide.jpg",
  "chest-press-station.jpg",
  "dumbbell-wall.jpg",
  "elliptical-row.jpg",
  "free-weight-rack.jpg",
  "lat-pulldown-red.jpg",
  "leg-press-red.jpg",
  "open-training-floor.jpg",
  "power-rack-black.jpg",
  "strength-machine-moss-wall.jpg",
  "turf-corner-sled-bags.jpg",
  "turf-zone-glass-wall.jpg",
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <section className="relative flex min-h-[94vh] items-center overflow-hidden border-b border-white/10 bg-black">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/gallery/main-training-floor.jpg"
            alt="Stellar Fitness Club training floor"
            className="animate-kenburns h-full w-full object-cover opacity-50"
          />
        </div>
        <Parallax
          speed={0.4}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="font-display select-none text-[26vw] leading-none text-white/[0.04]">
            STELLAR
          </span>
        </Parallax>

        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/75 to-black" />

        <div className="relative mx-auto max-w-6xl px-6 py-32">
          <Reveal>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.3em] text-blue-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              Stellar Fitness Club — Bengaluru
            </p>
          </Reveal>
          <HeroHeadline
            lines={[
              { words: ["Unleash", "Your"] },
              { words: ["Potential."], accent: true },
            ]}
            className="font-display mt-4 max-w-3xl text-6xl leading-[0.92] text-white sm:text-8xl"
          />
          <Reveal delay={0.55}>
            <p className="mt-6 max-w-xl text-lg text-zinc-400">
              A premium strength and conditioning gym built for people who
              want real results — heavy weights, honest coaching, and a
              community that shows up.
            </p>
          </Reveal>
          <Reveal delay={0.65}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/enquiry"
                className="rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_0_0_rgba(37,99,235,0.5)] transition-all duration-300 hover:scale-105 hover:bg-blue-500 hover:shadow-[0_0_40px_8px_rgba(37,99,235,0.35)] active:scale-95"
              >
                Book Free Trial
              </Link>
              <Link
                href="/membership"
                className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-all duration-300 hover:scale-105 hover:border-blue-500 hover:text-blue-500 active:scale-95"
              >
                Join Now
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="animate-bob pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
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

      <PhotoMarquee files={MARQUEE_PHOTOS} />

      <section className="border-b border-white/10 bg-black">
        <StaggerGroup className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-16 sm:grid-cols-4">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label} className="group text-center sm:text-left">
              <AnimatedCounter
                value={stat.value}
                suffix={stat.suffix}
                className="font-display block text-5xl text-blue-500 transition-transform duration-300 group-hover:scale-110 sm:origin-left"
              />
              <p className="mt-2 text-sm text-zinc-400">{stat.label}</p>
              <div className="mx-auto mt-3 h-0.5 w-8 bg-blue-600/40 transition-all duration-300 group-hover:w-16 group-hover:bg-blue-500 sm:mx-0" />
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
          {HIGHLIGHTS.map((item, i) => (
            <StaggerItem
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500/50 hover:shadow-[0_20px_40px_-20px_rgba(37,99,235,0.4)]"
            >
              <span className="font-display pointer-events-none absolute -right-2 -top-4 text-7xl text-white/[0.05] transition-colors duration-300 group-hover:text-blue-500/10">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="relative text-lg font-bold text-white">{item.title}</h3>
              <p className="relative mt-2 text-sm text-zinc-400">{item.body}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="border-y border-white/10 bg-black py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
                Inside Stellar
              </p>
              <h2 className="font-display mt-3 text-4xl text-white sm:text-5xl">
                The floor, in real life
              </h2>
            </div>
            <Link
              href="/gallery"
              className="text-sm font-bold uppercase tracking-wide text-blue-500 transition-colors hover:text-blue-400"
            >
              View full gallery →
            </Link>
          </Reveal>
        </div>

        <StaggerGroup className="mx-auto mt-12 grid max-w-6xl auto-rows-[140px] grid-cols-2 gap-3 px-6 sm:auto-rows-[180px] sm:grid-cols-4">
          {[
            { file: "cardio-deck-view.jpg", title: "Cardio deck", span: "col-span-2 row-span-2" },
            { file: "dumbbell-rack.jpg", title: "Free weight wall", span: "" },
            { file: "functional-bay-red-beams.jpg", title: "Functional bay", span: "" },
            { file: "squat-rack-bench.jpg", title: "Squat rack", span: "row-span-2" },
            { file: "locker-room.jpg", title: "Locker room", span: "" },
            { file: "smith-machine.jpg", title: "Smith machine", span: "" },
          ].map((img, i) => (
            <StaggerItem
              key={img.file}
              className={`group relative overflow-hidden rounded-xl border border-white/10 ${img.span}`}
            >
              <img
                src={`/gallery/${img.file}`}
                alt={img.title}
                className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.15] ${i % 2 === 0 ? "group-hover:-rotate-1" : "group-hover:rotate-1"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 text-xs font-bold uppercase tracking-wide text-white/90">
                {img.title}
              </span>
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
              className="text-sm font-bold uppercase tracking-wide text-blue-500 transition-colors hover:text-blue-400"
            >
              View all classes →
            </Link>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CLASSES.slice(0, 3).map((cls) => (
              <StaggerItem key={cls.slug}>
                <Link
                  href={`/classes/${cls.slug}`}
                  className="group relative block h-full overflow-hidden rounded-2xl border border-white/10 bg-black p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500/40 hover:shadow-[0_20px_40px_-20px_rgba(37,99,235,0.4)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-blue-600 transition-transform duration-300 group-hover:scale-x-100" />
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-500">
                    {cls.category}
                  </span>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    {cls.name}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">{cls.tagline}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors group-hover:text-blue-500">
                    Explore
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
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
            className="text-sm font-bold uppercase tracking-wide text-blue-500 transition-colors hover:text-blue-400"
          >
            Meet the full team →
          </Link>
        </Reveal>

        <HomeTrainers />
      </section>

      <section className="border-y border-white/10 bg-zinc-950 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Reveal>
            <span className="font-display block text-7xl leading-none text-blue-600/30">
              &ldquo;
            </span>
            <p className="-mt-8 text-xl font-medium leading-relaxed text-zinc-200 sm:text-2xl">
              {REVIEWS[0].text}
            </p>
            <div className="mt-6 flex items-center justify-center gap-1 text-blue-500">
              {Array.from({ length: REVIEWS[0].rating }).map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.538 1.118l-3.367-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.783.57-1.838-.196-1.538-1.118l1.287-3.957a1 1 0 00-.363-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.285-3.958z" />
                </svg>
              ))}
            </div>
            <p className="mt-4 text-sm font-bold uppercase tracking-wide text-blue-500">
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

      <section className="relative overflow-hidden py-28">
        <img
          src="/gallery/power-rack-bench.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/85 to-black" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-500">
              No more excuses
            </p>
            <h2 className="font-display mt-4 text-5xl text-white sm:text-6xl">
              Your first class is on us
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Come see the gym, meet the coaches, and try a class free — no
              pressure, no commitment.
            </p>
            <div className="mt-9">
              <Link
                href="/enquiry"
                className="inline-block rounded-full bg-blue-600 px-9 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_40px_8px_rgba(37,99,235,0.3)] transition-all duration-300 hover:scale-105 hover:bg-blue-500 hover:shadow-[0_0_60px_12px_rgba(37,99,235,0.45)] active:scale-95"
              >
                Book Your Free Session
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
