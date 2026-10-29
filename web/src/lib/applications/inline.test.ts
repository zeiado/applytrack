import { describe, expect, it } from "vitest";

import { inlineBody } from "./inline";

describe("inlineBody", () => {
  it("keeps names, but not empty ones", () => {
    expect(inlineBody("company", { value: "  Nile Labs " })).toEqual({ company: "Nile Labs" });
    expect(inlineBody("role_title", { value: " " })).toBeNull();
  });

  it("clears optional fields when emptied", () => {
    expect(inlineBody("job_url", { value: "" })).toEqual({ job_url: null });
    expect(inlineBody("applied_on", { value: "" })).toEqual({ applied_on: null });
    expect(inlineBody("notes", { value: "" })).toEqual({ notes: null });
  });

  it("checks links, dates and sources", () => {
    expect(inlineBody("job_url", { value: "https://jobs.example.com/1" })).toEqual({ job_url: "https://jobs.example.com/1" });
    expect(inlineBody("job_url", { value: "not a link" })).toBeNull();
    expect(inlineBody("applied_on", { value: "2026-10-30" })).toEqual({ applied_on: "2026-10-30" });
    expect(inlineBody("applied_on", { value: "30/10/2026" })).toBeNull();
    expect(inlineBody("source", { value: "referral" })).toEqual({ source: "referral" });
    expect(inlineBody("source", { value: "tiktok" })).toBeNull();
  });

  it("reads the salary range, in Arabic digits too, and keeps it in order", () => {
    expect(inlineBody("salary", { min: "٤٠٬٠٠٠", max: "55000" })).toEqual({ salary_min: 40000, salary_max: 55000 });
    expect(inlineBody("salary", { min: "", max: "" })).toEqual({ salary_min: null, salary_max: null });
    expect(inlineBody("salary", { min: "60000", max: "50000" })).toBeNull();
    expect(inlineBody("salary", { min: "a lot", max: "" })).toBeNull();
  });
});
