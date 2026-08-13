import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Membership | ${GYM_NAME}`,
  description:
    "Membership plans at Stellar Fitness Club — flexible pricing for gym floor, unlimited classes, and coached training access.",
};

type Plan = {
  name: string;
  price: string;
  originalPrice: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Monthly",
    price: "₹1,599",
    originalPrice: "₹1,999",
    cadence: "/month",
    description: "Full gym access, no long-term commitment.",
    features: [
      "Full gym floor & free weights",
      "Locker room access",
      "Group classes included",
      "Standard hours (5am–9pm)",
    ],
  },
  {
    name: "Quarterly",
    price: "₹4,999",
    originalPrice: "₹6,249",
    cadence: "/3 months",
    description: "Our most popular plan — train through a full season and save.",
    features: [
      "Everything in Monthly",
      "24/7 gym access",
      "1 guest pass per month",
      "Priority class booking",
    ],
    highlighted: true,
  },
  {
    name: "Annual",
    price: "₹5,999",
    originalPrice: "₹7,499",
    cadence: "/year",
    description: "Our best value plan for members who train year-round.",
    features: [
      "Everything in Quarterly",
      "Free fitness assessment every quarter",
      "2 guest passes per month",
      "Locked-in rate for the full year",
    ],
  },
];

const COMPARE_ROWS = [
  { label: "Gym floor access", basic: true, unlimited: true, coached: true },
  { label: "Locker rooms", basic: true, unlimited: true, coached: true },
  { label: "Group classes", basic: true, unlimited: true, coached: true },
  { label: "24/7 access", basic: false, unlimited: true, coached: true },
  { label: "Guest passes", basic: false, unlimited: true, coached: true },
  { label: "Priority class booking", basic: false, unlimited: true, coached: true },
  { label: "Quarterly fitness assessment", basic: false, unlimited: false, coached: true },
];

export default function MembershipPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
          Membership
        </p>
        <h1 className="font-display mt-4 text-5xl text-white sm:text-6xl">
          Simple, honest pricing
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          No joining fees, no long-term contracts. Cancel or change your plan
          anytime.
        </p>
      </Reveal>

      <StaggerGroup className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <StaggerItem
            key={plan.name}
            className={`flex h-full flex-col rounded-2xl border p-8 ${
              plan.highlighted
                ? "border-blue-500 bg-zinc-950 ring-1 ring-blue-500"
                : "border-white/10 bg-zinc-950"
            }`}
          >
            {plan.highlighted && (
              <span className="mb-4 inline-block w-fit rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Most Popular
              </span>
            )}
            <h2 className="text-xl font-bold text-white">{plan.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-lg text-zinc-500 line-through">
                {plan.originalPrice}
              </span>
              <span className="font-display text-5xl text-white">
                {plan.price}
              </span>
              <span className="text-sm text-zinc-400">{plan.cadence}</span>
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-zinc-300"
                >
                  <span className="mt-0.5 text-blue-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/book-visit"
              className={`mt-8 rounded-full px-5 py-3 text-center text-sm font-bold uppercase tracking-wide transition-colors ${
                plan.highlighted
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "border border-white/20 text-white hover:border-blue-500 hover:text-blue-500"
              }`}
            >
              Get Started
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <Reveal className="mt-20">
        <h2 className="font-display text-3xl text-white sm:text-4xl">
          Compare plans
        </h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-950 text-left text-zinc-300">
                <th className="px-5 py-4 font-semibold">Feature</th>
                <th className="px-5 py-4 text-center font-semibold">Monthly</th>
                <th className="px-5 py-4 text-center font-semibold text-blue-500">
                  Quarterly
                </th>
                <th className="px-5 py-4 text-center font-semibold">
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-white/5">
                  <td className="px-5 py-4 text-zinc-300">{row.label}</td>
                  <td className="px-5 py-4 text-center">
                    {row.basic ? (
                      <span className="text-blue-500">✓</span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {row.unlimited ? (
                      <span className="text-blue-500">✓</span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {row.coached ? (
                      <span className="text-blue-500">✓</span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal className="mt-10">
        <p className="text-sm text-zinc-500">
          Student and military discounts available. Have more questions?{" "}
          <Link href="/faq" className="font-semibold text-blue-500">
            Check the FAQ
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="font-semibold text-blue-500">
            contact us
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}
