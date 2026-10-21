import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Arabic first: most users are in Egypt. Visitors without a language in the URL
  // get the one their browser prefers, else Arabic.
  locales: ["ar", "en"],
  defaultLocale: "ar",
});

export type Locale = (typeof routing.locales)[number];

export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
