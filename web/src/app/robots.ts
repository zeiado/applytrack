import type { MetadataRoute } from "next";

import { SITE_URL } from "@/config/site";
import { routing } from "@/i18n/routing";

// Pages behind a login, and the API: nothing for search engines there.
const PRIVATE = ["/applications", "/follow-ups", "/stats", "/settings", "/profile", "/dashboard"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...routing.locales.flatMap((locale) => PRIVATE.map((path) => `/${locale}${path}`))],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
