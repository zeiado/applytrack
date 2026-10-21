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
