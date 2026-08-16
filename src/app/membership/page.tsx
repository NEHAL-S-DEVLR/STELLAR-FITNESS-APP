import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import MembershipPlans from "@/components/MembershipPlans";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Membership | ${GYM_NAME}`,
  description:
    "Membership plans at Stellar Fitness Club — flexible pricing for gym floor, unlimited classes, and coached training access.",
};

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

      <MembershipPlans />

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
