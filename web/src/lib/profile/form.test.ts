import { describe, expect, it } from "vitest";

import { profileBody, splitTags } from "./form";

describe("splitTags", () => {
  it("splits on commas, Arabic commas and new lines, trimming and dropping repeats", () => {
    expect(splitTags(" Python, SQL،Excel\npython ,, ")).toEqual(["Python", "SQL", "Excel"]);
    expect(splitTags("")).toEqual([]);
  });
});

describe("profileBody", () => {
  it("sends every field, so an emptied one is cleared", () => {
    const form = new FormData();
    form.set("display_name", "  Ada ");
    form.set("headline", "");
    form.set("experience_level", "student");
    form.set("skills", "Python, SQL");
    form.set("languages", "العربية، English");
    form.set("open_to_recruiters", "on");
    expect(profileBody(form)).toEqual({
      display_name: "Ada",
      headline: null,
      city: null,
      education: null,
      experience_level: "student",
      skills: ["Python", "SQL"],
      languages: ["العربية", "English"],
      visibility: "recruiters",
    });
  });

  it("is private, with no level, unless chosen", () => {
    const form = new FormData();
    form.set("experience_level", "guru");
    expect(profileBody(form)).toMatchObject({ experience_level: null, visibility: "private" });
  });
});
