import type { Metadata } from "next";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Terms & Conditions | ${GYM_NAME}`,
  description: `Terms and conditions for ${GYM_NAME}.`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
        Legal
      </p>
      <h1 className="font-display mt-4 text-5xl text-white">
        Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: placeholder</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-400">
        <section>
          <h2 className="text-lg font-bold text-white">Membership Terms</h2>
          <p className="mt-2">
            Memberships are billed monthly with no long-term contract.
            Members may cancel anytime with 30 days&apos; written notice.
            Membership fees are non-refundable except where required by law.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white">
            Facility Use & Conduct
          </h2>
          <p className="mt-2">
            Members must follow posted gym rules, re-rack equipment after
            use, and treat staff and other members with respect. Stellar
            Fitness Club reserves the right to suspend membership for
            violations of gym conduct policy.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white">
            Assumption of Risk
          </h2>
          <p className="mt-2">
            Exercise carries inherent risk of injury. By using Stellar
            Fitness Club facilities, members acknowledge this risk and agree
            to use equipment as instructed by staff.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white">Changes to Terms</h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use of the
            gym after changes constitutes acceptance of the updated terms.
          </p>
        </section>
      </div>
    </div>
  );
}
