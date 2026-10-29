// Edit in place (components/applications/inline-field.tsx): what one property's new value
// becomes in the PATCH body, or null when it isn't valid. The API checks again.
import type { components } from "@/lib/api/schema";

import { parseAmount } from "./form";
import { SOURCES } from "./model";

type Update = components["schemas"]["ApplicationUpdate"];

export const INLINE_FIELDS = ["company", "role_title", "job_url", "source", "applied_on", "salary", "notes"] as const;
export type InlineField = (typeof INLINE_FIELDS)[number];

/** `values` holds what was typed: one value, or `min` and `max` for the salary. */
export function inlineBody(field: InlineField, values: Record<string, string>): Update | null {
  const value = (values.value ?? "").trim();
  switch (field) {
    case "company":
    case "role_title":
      return value === "" || value.length > 200 ? null : { [field]: value };
    case "job_url":
      if (value === "") return { job_url: null };
      return /^https?:\/\/\S+$/i.test(value) ? { job_url: value } : null;
    case "source":
      return (SOURCES as readonly string[]).includes(value) ? { source: value as Update["source"] } : null;
    case "applied_on":
      if (value === "") return { applied_on: null };
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? { applied_on: value } : null;
    case "notes":
      return { notes: value === "" ? null : value };
    case "salary": {
      const min = parseAmount((values.min ?? "").trim());
      const max = parseAmount((values.max ?? "").trim());
      if (min === undefined || max === undefined) return null;
      if (min !== null && max !== null && min > max) return null;
      return { salary_min: min, salary_max: max };
    }
  }
}
