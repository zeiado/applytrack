// Interview times: people type and read them in their own timezone (their profile's,
// not the browser's); the API stores an exact moment in UTC.

function parts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

/** How far the zone's wall clock is ahead of UTC at that moment, in milliseconds. */
function offset(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-10-25T14:00" on the wall clock in `timeZone` → an ISO UTC instant, or null if
 * the text isn't a date and time. Handles daylight saving (Cairo moves in April and
 * October); a time skipped by the clock change moves forward an hour. */
export function zonedToUtc(local: string, timeZone: string): string | null {
  const match = LOCAL.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc) || mo > 12 || d > 31 || h > 23 || mi > 59) return null;
  // Guess with the offset at that moment, then correct once for a DST boundary.
  let instant = asUtc - offset(new Date(asUtc), timeZone);
  instant = asUtc - offset(new Date(instant), timeZone);
  return new Date(instant).toISOString();
}

/** An ISO instant → "2026-10-25T14:00" on the wall clock in `timeZone`, for a
 * datetime-local input. */
export function utcToZoned(iso: string, timeZone: string): string {
  const p = parts(new Date(iso), timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Sat, 25 Oct, 14:00" in the user's timezone and language. */
export function formatDateTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
