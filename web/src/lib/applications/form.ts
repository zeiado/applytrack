import type { ApplicationCreate, ApplicationSource } from "./model";
import { SOURCES } from "./model";

/** Field names, the same as the API's. */
export const FIELDS = [
  "company",
  "role_title",
  "job_url",
  "source",
  "status",
  "salary_min",
  "salary_max",
  "applied_on",
  "follow_up_on",
  "notes",
] as const;
export type Field = (typeof FIELDS)[number];

/** What the form shows again after a failed save (React resets forms after actions). */
export type FormValues = Partial<Record<Field, string>>;

type Body = Omit<ApplicationCreate, "status">;

function value(form: FormData, name: Field): string {
  const raw = form.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function optional(text: string): string | null {
  return text === "" ? null : text;
}

/** A whole number, from what people type: "15,000", "15 000" or Arabic-Indic digits
 * (١٥٠٠٠). null when empty, undefined when it isn't a number. */
export function parseAmount(text: string): number | null | undefined {
  if (text === "") return null;
  const digits = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[,٬\s]/g, "");
  return /^\d{1,9}$/.test(digits) ? Number(digits) : undefined;
}

export function formValues(form: FormData): FormValues {
  return Object.fromEntries(FIELDS.map((name) => [name, value(form, name)]));
}

/** The form's fields as an API body, or the fields that can't be sent as typed.
 * Empty optional fields are null, which clears them when editing. */
export function applicationBody(form: FormData): { body: Body } | { invalid: Field[] } {
  const salaryMin = parseAmount(value(form, "salary_min"));
  const salaryMax = parseAmount(value(form, "salary_max"));
  const invalid: Field[] = [];
  if (salaryMin === undefined) invalid.push("salary_min");
  if (salaryMax === undefined) invalid.push("salary_max");
  if (salaryMin === undefined || salaryMax === undefined) return { invalid };

  const source = value(form, "source");
  return {
    body: {
      company: value(form, "company"),
      role_title: value(form, "role_title"),
      job_url: optional(value(form, "job_url")),
      source: (SOURCES as readonly string[]).includes(source)
        ? (source as ApplicationSource)
        : "other",
      salary_min: salaryMin,
      salary_max: salaryMax,
      applied_on: optional(value(form, "applied_on")),
      follow_up_on: optional(value(form, "follow_up_on")),
      notes: optional(value(form, "notes")),
    },
  };
}

type ValidationDetail = { field?: string; message?: string };

/** Which fields the API rejected, from a 422's details ("body.salary_min" → salary_min).
 * The rule that spans two fields (minimum above maximum) is shown on salary_max. */
export function invalidFields(details: unknown, code?: string): Field[] {
  const fields = new Set<Field>();
  if (code === "invalid_salary_range") fields.add("salary_max");
  if (Array.isArray(details)) {
    for (const detail of details as ValidationDetail[]) {
      const name = detail.field?.split(".").at(-1);
      if (name && (FIELDS as readonly string[]).includes(name)) fields.add(name as Field);
      else if (detail.message?.includes("salary_min")) fields.add("salary_max");
    }
  }
  return [...fields];
}
