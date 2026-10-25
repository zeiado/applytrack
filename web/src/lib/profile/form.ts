// Shared by the profile form (browser) and its action (server).
import type { components } from "@/lib/api/schema";

export type Profile = components["schemas"]["ProfileRead"];
export type ProfileUpdate = components["schemas"]["ProfileUpdate"];
export type ExperienceLevel = components["schemas"]["ExperienceLevel"];

export const EXPERIENCE_LEVELS = [
  "student",
  "graduate",
  "junior",
  "mid",
  "senior",
] as const satisfies readonly ExperienceLevel[];

export const TEXT_FIELDS = ["display_name", "headline", "city", "education"] as const;
export const MAX_LENGTH = { display_name: 100, headline: 160, city: 100, education: 300 } as const;
export const MAX_SKILLS = 30;
export const MAX_LANGUAGES = 10;

/** "Python, SQL، Excel" → ["Python", "SQL", "Excel"]: commas (Arabic too) or new lines,
 * trimmed, empty ones and repeats (ignoring case) dropped. */
export function splitTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(/[,،\n]/)) {
    const tag = raw.trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  return tags;
}

/** The whole form as the API's update: every field is sent, so clearing one clears it. */
export function profileBody(form: FormData): ProfileUpdate {
  const text = (name: string) => String(form.get(name) ?? "").trim() || null;
  const level = String(form.get("experience_level") ?? "");
  return {
    display_name: text("display_name"),
    headline: text("headline"),
    city: text("city"),
    education: text("education"),
    experience_level: EXPERIENCE_LEVELS.find((value) => value === level) ?? null,
    skills: splitTags(String(form.get("skills") ?? "")),
    languages: splitTags(String(form.get("languages") ?? "")),
    visibility: form.get("open_to_recruiters") === "on" ? "recruiters" : "private",
  };
}
