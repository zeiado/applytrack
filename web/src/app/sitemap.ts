import type { MetadataRoute } from "next";

import { SITE_URL } from "@/config/site";
import { routing } from "@/i18n/routing";

/** The public pages, in each language, so search engines find them. */
const PUBLIC_PATHS = ["", "/features", "/roadmap", "/about", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((other) => [other, `${SITE_URL}/${other}${path}`])),
      },
    })),
  );
}
