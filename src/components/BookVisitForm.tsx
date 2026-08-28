"use client";

import { useState, useEffect, type FormEvent } from "react";

const GOALS = [
  "Lose weight",
  "Build muscle",
  "Get stronger",
  "General fitness",
  "Sport-specific training",
];

type Plan = { id: number; name: string; price: number; duration_days: number };
type Trainer = { id: number; name: string; specialization: string | null };

export default function BookVisitForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sameAsPhone, setSameAsPhone] = useState(true);

  useEffect(() => {
    fetch("/api/public/plans")
      .then((res) => (res.ok ? res.json() : []))
      .then(setPlans)
      .catch(() => setPlans([]));
    fetch("/api/public/trainers")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTrainers)
      .catch(() => setTrainers([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "book-visit",
          name: form.get("name"),
          phone: form.get("phone"),
          whatsapp: sameAsPhone ? null : form.get("whatsapp"),
          goal: form.get("goal"),
          preferredTrainer: form.get("trainer") || null,
          date: form.get("date"),
          time: form.get("time"),
          interestedPlanId: form.get("plan") || null,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError(
        "Something went wrong sending your request. Please call us or try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 text-blue-300">
        Your enquiry is in! A member of our team will reach out within one
        business day.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-zinc-200">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-zinc-200">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={sameAsPhone}
            onChange={(e) => setSameAsPhone(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-zinc-950 accent-blue-600"
          />
          My WhatsApp number is the same as my phone number
        </label>
        {!sameAsPhone && (
          <div className="mt-3">
            <label htmlFor="whatsapp" className="block text-sm font-semibold text-zinc-200">
              WhatsApp Number
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              required={!sameAsPhone}
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              placeholder="+91 98765 43210"
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="plan" className="block text-sm font-semibold text-zinc-200">
          Which plan are you interested in? (optional)
        </label>
        <select
          id="plan"
          name="plan"
          defaultValue=""
          className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">Not sure yet</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — ₹{plan.price.toLocaleString("en-IN")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-semibold text-zinc-200">
            Preferred Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none [color-scheme:dark]"
          />
        </div>
        <div>
          <label htmlFor="time" className="block text-sm font-semibold text-zinc-200">
            Preferred Time
          </label>
          <input
            id="time"
            name="time"
            type="time"
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="goal" className="block text-sm font-semibold text-zinc-200">
            Fitness Goal
          </label>
          <select
            id="goal"
            name="goal"
            required
            defaultValue=""
            className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Select a goal
            </option>
            {GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trainer" className="block text-sm font-semibold text-zinc-200">
            Preferred Trainer (optional)
          </label>
          <select
            id="trainer"
            name="trainer"
            defaultValue=""
            className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">No preference</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.name}>
                {trainer.name}
                {trainer.specialization ? ` — ${trainer.specialization}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-blue-600 px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Submit Enquiry"}
      </button>
    </form>
  );
}
