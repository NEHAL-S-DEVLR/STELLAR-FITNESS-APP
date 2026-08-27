"use client";

import { useEffect, useState } from "react";

// iOS Safari exposes `navigator.standalone` when launched from a home-screen
// icon; other browsers report the same thing via the display-mode media
// query. Neither alone covers every installed-PWA case, so check both.
function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function StandaloneLoginButton() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  if (!standalone) return null;

  return (
    <a
      href="/login.html"
      className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
      </svg>
      Login
    </a>
  );
}
