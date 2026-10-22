import type { MetadataRoute } from "next";

import { APP_NAME } from "@/config/brand";

/** Makes the web app installable ("Add to Home screen"), served at /manifest.webmanifest.
 * One manifest for both languages: the proxy opens each user's own language. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Track your job applications, follow-ups and interviews. تابع تقديماتك على الشغل ومقابلاتك.",
    start_url: "/applications",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "auto",
    background_color: "#FAF8F4",
    theme_color: "#00695a",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
