import type { NextConfig } from "next";

// The management backend (/backend) runs as its own Express process. In dev
// these rewrites proxy its pages/API through this app's own port so the
// whole thing is reachable from a single origin (localhost:3000) instead of
// the visitor having to know about a second port. In production this same
// job is done by platform-level rewrites (e.g. vercel.json), since
// `output: "export"` below means this file's rewrites don't run in the
// exported static build.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:4000";
const BACKEND_PAGES = [
  "login.html", "admin.html", "admin.js", "admin-nav.js",
  "admissions.html", "admissions.js", "api.js",
  "checkin.html",
  "enquiries.html", "enquiries.js",
  "expenses.html", "expenses.js", "library.js",
  "gallery-admin.html", "gallery-admin.js",
  "gym-pass.html", "member-verify.html",
  "manual.html",
  "plans.html", "plans.js",
  "profile.html", "profile.js",
  "registration-form.html",
  "reports.html", "reports.js", "styles.css",
  "trainer-portal.html", "trainer-portal.js",
  "trainers.html", "trainers.js",
  "workout-plan.html", "workout-plan.js",
];

const nextConfig: NextConfig = {
  output: "export",
  async rewrites() {
    return [
      ...BACKEND_PAGES.map((page) => ({
        source: `/${page}`,
        destination: `${BACKEND_ORIGIN}/${page}`,
      })),
      { source: "/uploads/:path*", destination: `${BACKEND_ORIGIN}/uploads/:path*` },
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
