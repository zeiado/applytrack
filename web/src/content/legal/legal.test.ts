import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

import { privacy } from "./privacy";
import { terms } from "./terms";

describe.each([
  ["privacy", privacy],
  ["terms", terms],
])("%s", (_, text) => {
  it("has a valid date", () => {
    expect(text.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(text.updated))).toBe(false);
  });

  it("has the same sections, in the same order and shape, in every language", () => {
    const shape = (locale: (typeof routing.locales)[number]) =>
      text[locale].sections.map((section) => ({
        id: section.id,
        body: section.body.map((block) => (typeof block === "string" ? "p" : block.list.length)),
      }));
    for (const locale of routing.locales) expect(shape(locale)).toEqual(shape("en"));
  });

  it("has unique section ids that don't clash with the contact section", () => {
    const ids = text.en.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("contact");
  });
});
