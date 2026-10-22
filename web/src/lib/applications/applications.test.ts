import { describe, expect, it } from "vitest";

import { addDays, followUpState, formatDate, todayIn } from "./dates";
import { applicationBody, invalidFields, parseAmount } from "./form";
import { hasFilters, parseListQuery, searchParamsObject, toApiParams, toExportSearch, toSearch } from "./query";

describe("parseListQuery", () => {
  it("reads filters, sort and page from the URL", () => {
    const query = parseListQuery({
      view: "list",
      status: ["applied", "offer", "applied"],
      source: "referral",
      company: "  Vodafone ",
      sort: "company",
      page: "3",
    });

    expect(query).toEqual({
      statuses: ["applied", "offer"],
      source: "referral",
      company: "Vodafone",
      sort: "company",
      page: 3,
    });
    expect(toApiParams(query)).toEqual({
      status: ["applied", "offer"],
      source: ["referral"],
      company: "Vodafone",
      sort: "company",
      limit: 20,
      offset: 40,
    });
  });

  it("drops what it doesn't understand instead of failing", () => {
    expect(
      parseListQuery({ status: ["nope", "offer"], source: "x", sort: "y", page: "-2" }),
    ).toEqual({ statuses: ["offer"], source: null, company: "", sort: "-created_at", page: 1 });
    expect(parseListQuery({ page: "abc" }).page).toBe(1);
  });

  it("builds pagination links that keep the filters", () => {
    const query = parseListQuery({ status: "applied", company: "Valeo" });

    expect(toSearch(query, { page: 2 })).toBe("?view=list&status=applied&company=Valeo&page=2");
    expect(toSearch(parseListQuery({}))).toBe("?view=list");
    expect(hasFilters(query)).toBe(true);
    expect(hasFilters(parseListQuery({ sort: "company" }))).toBe(false);
  });
});

describe("parseAmount", () => {
  it.each([
    ["", null],
    ["15000", 15000],
    ["15,000", 15000],
    ["15 000", 15000],
    ["١٥٠٠٠", 15000],
    ["۱۵۰۰۰", 15000],
    ["١٥٬٠٠٠", 15000],
    ["15k", undefined],
    ["-5", undefined],
    ["1.5", undefined],
  ])("%s → %s", (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });
});

describe("applicationBody", () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  }

  it("turns the form into an API body; empty optional fields clear them", () => {
    const parsed = applicationBody(
      form({
        company: " Instabug ",
        role_title: "Backend Engineer",
        job_url: "",
        source: "referral",
        salary_min: "20,000",
        salary_max: "",
        applied_on: "2026-10-20",
        follow_up_on: "",
        notes: "",
      }),
    );

    expect(parsed).toEqual({
      body: {
        company: "Instabug",
        role_title: "Backend Engineer",
        job_url: null,
        source: "referral",
        salary_min: 20000,
        salary_max: null,
        applied_on: "2026-10-20",
        follow_up_on: null,
        notes: null,
      },
    });
  });

  it("reports amounts it can't read, and an unknown source becomes other", () => {
    expect(applicationBody(form({ salary_min: "lots", salary_max: "10k" }))).toEqual({
      invalid: ["salary_min", "salary_max"],
    });
    const parsed = applicationBody(form({ company: "A", role_title: "B", source: "tiktok" }));
    expect("body" in parsed && parsed.body.source).toBe("other");
  });
});

describe("invalidFields", () => {
  it("maps the API's validation details to form fields", () => {
    const details = [
      { field: "body.job_url", message: "Input should be a valid URL", type: "url_parsing" },
      { field: "body", message: "Value error, salary_min must be less than or equal to salary_max" },
      { field: "query.limit", message: "x" },
    ];
    expect(invalidFields(details).sort()).toEqual(["job_url", "salary_max"]);
    expect(invalidFields(undefined, "invalid_salary_range")).toEqual(["salary_max"]);
  });
});

describe("dates", () => {
  it("finds today in the user's timezone", () => {
    // 23:30 UTC on Oct 21 is already Oct 22 in Cairo (UTC+3 in summer time).
    const late = new Date("2026-10-21T23:30:00Z");
    expect(todayIn("Africa/Cairo", late)).toBe("2026-10-22");
    expect(todayIn("America/New_York", late)).toBe("2026-10-21");
    expect(todayIn("Not/AZone", late)).toBe("2026-10-22");
  });

  it("formats calendar dates without shifting the day", () => {
    expect(formatDate("2026-10-25", "en", "2026-10-21")).toBe("Oct 25");
    expect(formatDate("2025-01-03", "en", "2026-10-21")).toBe("Jan 3, 2025");
    expect(formatDate("2026-10-25", "ar", "2026-10-21")).toMatch(/أكتوبر/);
  });

  it("tells overdue, due and upcoming follow-ups apart", () => {
    expect(followUpState("2026-10-20", "2026-10-21")).toBe("overdue");
    expect(followUpState("2026-10-21", "2026-10-21")).toBe("due");
    expect(followUpState("2026-10-22", "2026-10-21")).toBe("upcoming");
  });

  it("adds days across months and leap years", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 7)).toBe("2027-01-07");
  });
});

describe("CSV export query", () => {
  it("keeps the list's filters and sort, but not the page", () => {
    const url = new URLSearchParams("view=list&status=applied&status=offer&company=Valeo&sort=company&page=3");
    const query = parseListQuery(searchParamsObject(url));
    expect(toExportSearch(query)).toBe("?status=applied&status=offer&company=Valeo&sort=company");
  });

  it("exports everything, newest first, without filters", () => {
    expect(toExportSearch(parseListQuery({}))).toBe("?sort=-created_at");
  });

  it("drops values the API would reject", () => {
    const query = parseListQuery(searchParamsObject(new URLSearchParams("status=nope&source=fax&bom=false")));
    expect(toExportSearch(query)).toBe("?sort=-created_at");
  });
});
