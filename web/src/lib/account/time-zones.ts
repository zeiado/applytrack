// IANA timezones for the settings picker. Most users are in Egypt or the Gulf, so
// those come first; the rest follow alphabetically.

export const SUGGESTED_TIME_ZONES = [
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Bahrain",
  "Asia/Muscat",
  "Asia/Amman",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Toronto",
] as const;

export function allTimeZones(): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  // Some runtimes list "UTC" only as "Etc/UTC"; keep both names valid.
  zones.add("UTC");
  return [...zones].sort();
}

export function isTimeZone(name: string): boolean {
  if (name === "" || name.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** "Africa/Cairo" → "Cairo (Africa)", with the current UTC offset: "Cairo (Africa) · GMT+3". */
export function timeZoneLabel(name: string, now: Date = new Date()): string {
  const offset =
    new Intl.DateTimeFormat("en", { timeZone: name, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const [region, ...place] = name.split("/");
  const city = place.length > 0 ? `${place.join(" / ").replaceAll("_", " ")} (${region})` : name;
  return offset ? `${city} · ${offset}` : city;
}
