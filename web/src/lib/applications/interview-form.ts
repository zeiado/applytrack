import { parseAmount } from "./form";
import { INTERVIEW_KINDS, type InterviewKind } from "./model";
import { zonedToUtc } from "./zoned-time";

export const INTERVIEW_FIELDS = [
  "scheduled_at",
  "kind",
  "duration_minutes",
  "interviewer",
  "notes",
] as const;
export type InterviewField = (typeof INTERVIEW_FIELDS)[number];
export type InterviewValues = Partial<Record<InterviewField, string>>;

type Body = {
  scheduled_at: string;
  kind: InterviewKind;
  duration_minutes: number | null;
  interviewer: string | null;
  notes: string | null;
};

function value(form: FormData, name: InterviewField): string {
  const raw = form.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

export function interviewValues(form: FormData): InterviewValues {
  return Object.fromEntries(INTERVIEW_FIELDS.map((name) => [name, value(form, name)]));
}

/** The form as an API body. The date and time were typed in the user's timezone. */
export function interviewBody(
  form: FormData,
  timeZone: string,
): { body: Body } | { invalid: InterviewField[] } {
  const invalid: InterviewField[] = [];
  const scheduledAt = zonedToUtc(value(form, "scheduled_at"), timeZone);
  if (!scheduledAt) invalid.push("scheduled_at");
  const duration = parseAmount(value(form, "duration_minutes"));
  if (duration === undefined || (duration !== null && (duration < 1 || duration > 1440))) {
    invalid.push("duration_minutes");
  }
  if (invalid.length > 0 || !scheduledAt || duration === undefined) return { invalid };

  const kind = value(form, "kind");
  return {
    body: {
      scheduled_at: scheduledAt,
      kind: (INTERVIEW_KINDS as readonly string[]).includes(kind) ? (kind as InterviewKind) : "other",
      duration_minutes: duration,
      interviewer: value(form, "interviewer") || null,
      notes: value(form, "notes") || null,
    },
  };
}
