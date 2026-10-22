"use client";

import { useEffect } from "react";

import { captureInstallPrompt } from "@/lib/pwa/install";

/** Registers /sw.js (the offline page) and keeps the install prompt for later. Only in
 * production builds: in development a service worker would serve stale code. */
export function ServiceWorker() {
  useEffect(() => {
    const stop = captureInstallPrompt();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });
    }
    return stop;
  }, []);
  return null;
}
