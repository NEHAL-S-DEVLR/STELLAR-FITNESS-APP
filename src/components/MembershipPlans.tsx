"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";

type ApiPlan = {
  id: number;
  name: string;
  price: number;
  originalPrice: number | null;
  duration_days: number;
  description: string | null;
  features: string[] | null;
  highlighted: boolean;
};

function cadenceFor(days: number) {
  if (days <= 31) return "/month";
  if (days <= 92) return "/3 months";
  if (days <= 183) return "/6 months";
  return "/year";
}

const money = (v: number) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function MembershipPlans() {
  const [plans, setPlans] = useState<ApiPlan[] | null>(null);

  useEffect(() => {
    fetch("/api/public/plans")
      .then((res) => (res.ok ? res.json() : []))
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  if (plans === null) {
    return (
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-white/10 bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <p className="mt-12 text-sm text-zinc-500">
        Pricing is being updated right now — please{" "}
        <Link href="/contact" className="font-semibold text-blue-500">
          contact us
        </Link>{" "}
        for current plans.
      </p>
    );
  }

  return (
    <StaggerGroup className="mt-12 grid gap-6 lg:grid-cols-3">
      {plans.map((plan) => (
        <StaggerItem
          key={plan.id}
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
          {plan.description && (
            <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
          )}
          <p className="mt-6 flex items-baseline gap-2">
            {plan.originalPrice && plan.originalPrice > plan.price && (
              <span className="text-lg text-zinc-500 line-through">
                {money(plan.originalPrice)}
              </span>
            )}
            <span className="font-display text-5xl text-white">
              {money(plan.price)}
            </span>
            <span className="text-sm text-zinc-400">{cadenceFor(plan.duration_days)}</span>
          </p>

          {plan.features && plan.features.length > 0 && (
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 text-blue-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/enquiry"
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
  );
}
