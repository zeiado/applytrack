// Dates in the API are plain calendar dates ("2026-10-25"), with no time or timezone.

/** Today's date where the user is, as YYYY-MM-DD (en-CA formats dates that way). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(now);
  }
}

/** "25 Oct" / "٢٥ أكتوبر"; with the year when it isn't this year's. */
export function formatDate(date: string, locale: string, today: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(value);
}

export type FollowUp = "overdue" | "due" | "upcoming";

/** ISO dates compare correctly as strings. */
export function followUpState(followUpOn: string, today: string): FollowUp {
  if (followUpOn < today) return "overdue";
  return followUpOn === today ? "due" : "upcoming";
}

/** The calendar date `days` days after `date` (both YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return value.toISOString().slice(0, 10);
}

/** Still applied or in screening this many days after getting there: "no reply". */
export const NO_REPLY_DAYS = 30;

/** Days without a reply (`stageSince` is the API's stage_since), or null when it isn't
 * waiting on the company or hasn't waited NO_REPLY_DAYS yet. */
export function noReplyDays(status: string, stageSince: string, today: string): number | null {
  if (status !== "applied" && status !== "screening") return null;
  const [y1, m1, d1] = stageSince.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1) - Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1)) / 86_400_000,
  );
  return days >= NO_REPLY_DAYS ? days : null;
}
