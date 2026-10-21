import { describe, expect, it } from "vitest";

import { allTimeZones, isTimeZone, SUGGESTED_TIME_ZONES, timeZoneLabel } from "./time-zones";

describe("time zones", () => {
  it("lists every suggested zone among all zones", () => {
    const all = new Set(allTimeZones());
    for (const zone of SUGGESTED_TIME_ZONES) expect(all.has(zone)).toBe(true);
    expect(all.has("UTC")).toBe(true);
  });

  it("checks names", () => {
    expect(isTimeZone("Africa/Cairo")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });

  it("labels a zone with its city and current offset", () => {
    expect(timeZoneLabel("Africa/Cairo", new Date("2026-07-01T12:00:00Z"))).toBe("Cairo (Africa) · GMT+3");
    expect(timeZoneLabel("Africa/Cairo", new Date("2026-12-01T12:00:00Z"))).toBe("Cairo (Africa) · GMT+2");
    expect(timeZoneLabel("America/Argentina/Buenos_Aires", new Date("2026-07-01T12:00:00Z"))).toBe(
      "Argentina / Buenos Aires (America) · GMT-3",
    );
  });
});
