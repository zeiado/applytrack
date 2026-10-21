import { describe, expect, it } from "vitest";

import { formatDateTime, utcToZoned, zonedToUtc } from "./zoned-time";

describe("zonedToUtc", () => {
  it("converts a Cairo wall-clock time in summer (UTC+3) and winter (UTC+2)", () => {
    expect(zonedToUtc("2026-07-15T14:00", "Africa/Cairo")).toBe("2026-07-15T11:00:00.000Z");
    expect(zonedToUtc("2026-12-15T14:00", "Africa/Cairo")).toBe("2026-12-15T12:00:00.000Z");
  });

  it("works for other zones, including ones behind UTC", () => {
    expect(zonedToUtc("2026-03-01T09:30", "Asia/Riyadh")).toBe("2026-03-01T06:30:00.000Z");
    expect(zonedToUtc("2026-01-10T09:00", "America/New_York")).toBe("2026-01-10T14:00:00.000Z");
    expect(zonedToUtc("2026-01-10T23:30", "UTC")).toBe("2026-01-10T23:30:00.000Z");
  });

  it("round-trips with utcToZoned", () => {
    for (const local of ["2026-04-30T23:59", "2026-10-29T08:15", "2026-01-01T00:00"]) {
      const utc = zonedToUtc(local, "Africa/Cairo");
      expect(utc && utcToZoned(utc, "Africa/Cairo")).toBe(local);
    }
  });

  it("rejects text that isn't a date and time", () => {
    for (const bad of ["", "2026-10-25", "tomorrow", "2026-13-01T10:00", "2026-10-25T25:00"]) {
      expect(zonedToUtc(bad, "Africa/Cairo")).toBeNull();
    }
  });
});

describe("formatDateTime", () => {
  it("shows the time in the user's zone and language", () => {
    const text = formatDateTime("2026-10-25T11:00:00Z", "en", "Africa/Cairo");
    expect(text).toContain("Oct");
    expect(text).toMatch(/2:00\s?PM|14:00/);
    expect(formatDateTime("2026-10-25T11:00:00Z", "ar", "Africa/Cairo")).toMatch(/أكتوبر/);
  });
});

describe("interviewBody", () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  }

  it("sends the typed time as UTC, in the user's timezone", async () => {
    const { interviewBody } = await import("./interview-form");
    const parsed = interviewBody(
      form({ scheduled_at: "2026-11-02T10:30", kind: "technical", duration_minutes: "45", interviewer: " Mona ", notes: "" }),
      "Africa/Cairo",
    );
    expect(parsed).toEqual({
      body: {
        scheduled_at: "2026-11-02T08:30:00.000Z",
        kind: "technical",
        duration_minutes: 45,
        interviewer: "Mona",
        notes: null,
      },
    });
  });

  it("reports a missing time and an impossible length", async () => {
    const { interviewBody } = await import("./interview-form");
    expect(interviewBody(form({ scheduled_at: "", duration_minutes: "0" }), "Africa/Cairo")).toEqual({
      invalid: ["scheduled_at", "duration_minutes"],
    });
    expect(interviewBody(form({ scheduled_at: "2026-11-02T10:30", duration_minutes: "an hour" }), "UTC")).toEqual({
      invalid: ["duration_minutes"],
    });
  });
});
