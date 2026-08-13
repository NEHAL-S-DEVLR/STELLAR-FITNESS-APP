import type { Metadata } from "next";
import { GYM_NAME } from "@/lib/nav";

export const metadata: Metadata = {
  title: `Privacy Policy | ${GYM_NAME}`,
  description: `Privacy policy for ${GYM_NAME}.`,
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-500">
        Legal
      </p>
      <h1 className="font-display mt-4 text-5xl text-white">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: placeholder</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-400">
        <section>
          <h2 className="text-lg font-bold text-white">
            Information We Collect
          </h2>
          <p className="mt-2">
            When you book a visit, contact us, or sign up for membership, we
            collect information such as your name, phone number, email
            address, and fitness goals to provide our services.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white">
            How We Use Your Information
          </h2>
          <p className="mt-2">
            We use your information to manage your membership, communicate
            about classes and bookings, and improve our services. We do not
            sell your personal information to third parties.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white">Data Security</h2>
          <p className="mt-2">
            We take reasonable technical and organizational measures to
            protect your personal information from unauthorized access, loss,
            or misuse.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white">Contact Us</h2>
          <p className="mt-2">
            If you have questions about this policy, contact us at
            hello@stellarfitnessclub.example.
          </p>
        </section>
      </div>
    </div>
  );
}
