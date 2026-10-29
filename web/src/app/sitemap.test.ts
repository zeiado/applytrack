import { describe, expect, it } from "vitest";

import robots from "./robots";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists every public page in both languages, each pointing at the other", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url.replace(/^https?:\/\/[^/]+/, ""));

    for (const path of ["", "/features", "/roadmap", "/about", "/privacy", "/terms"]) {
      expect(urls).toContain(`/ar${path}`);
      expect(urls).toContain(`/en${path}`);
    }
    const about = entries.find((entry) => entry.url.endsWith("/en/about"));
    expect(Object.keys(about?.alternates?.languages ?? {})).toEqual(["ar", "en"]);
  });

  it("keeps search engines out of the app and the API", () => {
    const { rules } = robots();
    const disallow = Array.isArray(rules) ? rules.flatMap((rule) => rule.disallow ?? []) : rules.disallow;

    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/ar/applications");
    expect(disallow).toContain("/en/settings");
  });
});
