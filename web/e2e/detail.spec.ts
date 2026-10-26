import { expect, type Page, test } from "@playwright/test";

import { AUTH_TIMEOUT, register } from "./helpers";

async function openNewApplication(page: Page, company: string) {
  await page.goto("/en/applications/new");
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Role").fill("Software Engineer");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
  await page.getByRole("link", { name: company }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(company);
}

function section(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title, level: 2 }) });
}

test.beforeEach(async ({ page }) => {
  await register(page);
});

test("the history starts when the application is added", async ({ page }) => {
  await openNewApplication(page, "Instabug");

  await expect(section(page, "History")).toContainText("Added as Applied");
  await expect(section(page, "Interviews")).toContainText("No interviews yet.");
});

test("move to the next stage with a note, and see it in the history", async ({ page }) => {
  await openNewApplication(page, "Vodafone");

  const nextStep = section(page, "Next step");
  await nextStep.getByLabel("Move to").selectOption("interviewing");
  await nextStep.getByLabel("Note").fill("HR called, technical interview next week");
  await nextStep.getByRole("button", { name: "Move" }).click();

  await expect(page.getByText("Interviewing", { exact: true }).first()).toBeVisible();
  const history = section(page, "History");
  await expect(history).toContainText("Applied → Interviewing", AUTH_TIMEOUT);
  await expect(history).toContainText("HR called, technical interview next week");
  // From interviewing, the next choices are different.
  await expect(nextStep.getByLabel("Move to").locator("option")).toHaveText(["Offer", "Rejected", "Withdrawn"]);
});

test("add a job description, and see it on the application", async ({ page }) => {
  await openNewApplication(page, "Fawry");
  const jobDescription = section(page, "Job description");
  await expect(jobDescription).toContainText("No job description yet.");

  await jobDescription.getByRole("link", { name: "Add job description" }).click();
  await expect(page.getByRole("heading", { name: "Edit application" })).toBeVisible();
  await page.getByLabel("Job description").fill(["We need a backend engineer.", "", "You know Python and SQL."].join("\n"));
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fawry", AUTH_TIMEOUT);
  const description = page.getByRole("region", { name: "Full job description" });
  await expect(description).toContainText("We need a backend engineer.");
  await expect(description).toContainText("You know Python and SQL.");
});

test("set and clear the follow-up date", async ({ page }) => {
  await openNewApplication(page, "Paymob");
  const followUp = section(page, "Follow-up");

  await followUp.getByLabel("Follow up on").fill("2026-01-05");
  await followUp.getByRole("button", { name: "Save date" }).click();
  await expect(followUp.getByRole("status")).toHaveText("Saved.", AUTH_TIMEOUT);
  await expect(followUp.getByRole("heading")).toContainText("Overdue");

  await followUp.getByRole("button", { name: "Clear" }).click();
  await expect(followUp.getByLabel("Follow up on")).toHaveValue("", AUTH_TIMEOUT);
  await expect(followUp.getByRole("button", { name: "Clear" })).toHaveCount(0);
});

test("add, edit and delete an interview", async ({ page }) => {
  await openNewApplication(page, "Swvl");
  const interviews = section(page, "Interviews");

  await interviews.getByRole("button", { name: "Add interview" }).click();
  await interviews.getByLabel("Date and time").fill("2030-05-01T14:00");
  await interviews.getByLabel("Type").selectOption("technical");
  await interviews.getByLabel("Length (minutes)").fill("45");
  await interviews.getByLabel("Interviewer").fill("Mona");
  await interviews.getByRole("button", { name: "Save interview" }).click();

  // Shown in the user's timezone (Cairo by default), as typed.
  const item = interviews.locator("article");
  await expect(item).toContainText("2:00", AUTH_TIMEOUT);
  await expect(item).toContainText("Technical · 45 min · with Mona");
  await expect(item).toContainText("Upcoming");

  await item.getByRole("button", { name: "Edit" }).click();
  await expect(interviews.getByLabel("Date and time")).toHaveValue("2030-05-01T14:00");
  await interviews.getByLabel("Length (minutes)").fill("60");
  await interviews.getByRole("button", { name: "Save interview" }).click();
  await expect(item).toContainText("60 min", AUTH_TIMEOUT);

  await item.getByRole("button", { name: "Delete" }).click();
  await item.getByRole("button", { name: "Delete" }).click();
  await expect(interviews).toContainText("No interviews yet.", AUTH_TIMEOUT);
});

test("an interview without a time is pointed out", async ({ page }) => {
  await openNewApplication(page, "Fawry");
  const interviews = section(page, "Interviews");

  await interviews.getByRole("button", { name: "Add interview" }).click();
  // The browser's own check would stop an empty required field; remove it to test ours.
  await interviews.getByLabel("Date and time").evaluate((input) => input.removeAttribute("required"));
  await interviews.getByRole("button", { name: "Save interview" }).click();

  await expect(interviews.getByText("Choose a date and time.")).toBeVisible(AUTH_TIMEOUT);
});

test("an application that doesn't exist shows the not-found page", async ({ page }) => {
  await page.goto("/en/applications/00000000-0000-4000-8000-000000000000");

  // The page streams in after the response has started, so the HTTP status stays 200;
  // Next.js marks it noindex instead.
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
