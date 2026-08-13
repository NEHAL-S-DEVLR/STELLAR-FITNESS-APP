import type { Metadata } from "next";
import Reveal from "@/components/motion/Reveal";
import ContactForm from "@/components/ContactForm";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Contact | ${GYM_NAME}`,
  description:
    "Get in touch with Stellar Fitness Club — visit the gym, ask a question, or book your free first class.",
};

const HOURS = [
  { day: "Monday – Friday", time: "5:00am – 11:00pm" },
  { day: "Saturday", time: "7:00am – 8:00pm" },
  { day: "Sunday", time: "7:00am – 6:00pm" },
];

const SOCIALS = [
  { label: "WhatsApp", handle: "+91 98765 43210" },
  { label: "Instagram", handle: "@stellarfitnessclub" },
  { label: "Facebook", handle: "/stellarfitnessclub" },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Get In Touch
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Contact us
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Questions about membership, classes, or coaching? Send us a message
          or stop by — we&apos;d love to show you around.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <ContactForm />

          <div className="mt-10 flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black text-sm text-zinc-500">
            Map placeholder — 123 Fitness Ave, Bengaluru
          </div>
        </Reveal>

        <Reveal direction="left" delay={0.1} className="space-y-8">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
              Address
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              123 Fitness Ave, Suite 100
              <br />
              Bengaluru, KA 560001
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
              Contact
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              (555) 123-4567
              <br />
              hello@stellarfitnessclub.example
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
              Social
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-400">
              {SOCIALS.map((s) => (
                <li key={s.label} className="flex justify-between gap-4">
                  <span>{s.label}</span>
                  <span className="text-zinc-300">{s.handle}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-200">
              Hours
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-zinc-400">
              {HOURS.map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{h.day}</span>
                  <span className="text-zinc-300">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
