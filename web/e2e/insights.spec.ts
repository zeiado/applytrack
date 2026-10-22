import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { AUTH_TIMEOUT, register } from "./helpers";

async function addApplication(page: Page, company: string, followUp?: string) {
  await page.goto("/en/applications/new");
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Role").fill("Software Engineer");
  if (followUp) await page.getByLabel(/Follow up on/).fill(followUp);
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
}

/** A date a few days from now; "in N days" is the same in every timezone near UTC. */
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function group(page: Page, title: RegExp) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title, level: 2 }) });
}

test.beforeEach(async ({ page }) => {
  await register(page);
});

test.describe("follow-ups", () => {
  test("a new account has nothing to follow up on", async ({ page }) => {
    await page.getByRole("link", { name: "Follow-ups" }).click();
    await expect(page.getByRole("heading", { name: "Nothing to follow up on" })).toBeVisible(AUTH_TIMEOUT);
  });

  test("overdue and upcoming follow-ups; mark one done", async ({ page }) => {
    await addApplication(page, "Instabug", "2026-01-05");
    await addApplication(page, "Swvl", daysFromNow(4));
    await addApplication(page, "Valeo"); // no follow-up date: not listed

    await page.goto("/en/follow-ups");
    const overdue = group(page, /^Overdue \(1\)$/);
    await expect(overdue).toContainText("Instabug", AUTH_TIMEOUT);
    await expect(overdue).toContainText(/\d+ days overdue/);
    await expect(group(page, /^Next 7 days \(1\)$/)).toContainText("Swvl");
    await expect(page.getByText("Valeo")).toHaveCount(0);

    await overdue.getByRole("button", { name: "Mark Instabug done" }).click();
    await expect(group(page, /^Overdue/)).toHaveCount(0, AUTH_TIMEOUT);
    await expect(group(page, /^Next 7 days/)).toContainText("Swvl");
  });

  test("snoozing moves it three days ahead", async ({ page }) => {
    await addApplication(page, "Paymob", "2026-01-05");

    await page.goto("/en/follow-ups");
    await page.getByRole("button", { name: "Remind me about Paymob in 3 days" }).click(AUTH_TIMEOUT);

    const upcoming = group(page, /^Next 7 days \(1\)$/);
    await expect(upcoming).toContainText("Paymob", AUTH_TIMEOUT);
    await expect(upcoming).toContainText("In 3 days");
    // Not due yet: it can only be marked done.
    await expect(upcoming.getByRole("button", { name: /Remind me/ })).toHaveCount(0);
  });
});

test.describe("stats", () => {
  test("a new account sees how to start", async ({ page }) => {
    await page.getByRole("link", { name: "Stats" }).click();
    await expect(page.getByRole("heading", { name: "No stats yet" })).toBeVisible(AUTH_TIMEOUT);
  });

  test("the funnel and rates follow the applications", async ({ page }) => {
    await addApplication(page, "Instabug");
    await addApplication(page, "Vodafone");
    // Move one to interviewing.
    await page.getByRole("link", { name: "Vodafone" }).click();
    await page.getByLabel("Move to").selectOption("interviewing");
    await page.getByRole("button", { name: "Move" }).click();
    await expect(page.getByText("Applied → Interviewing")).toBeVisible(AUTH_TIMEOUT);

    await page.goto("/en/stats");
    const tile = (label: string) => page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) });
    await expect(tile("Applications")).toContainText("2", AUTH_TIMEOUT);
    await expect(tile("Response rate")).toContainText("50%");
    await expect(tile("Interview rate")).toContainText("1 of 2 applied");
    await expect(tile("Offer rate")).toContainText("0%");

    const funnel = group(page, /^Funnel$/);
    await expect(funnel.getByRole("listitem")).toHaveText([
      /Applied\s*2/,
      /Got a reply\s*1 · 50%/,
      /Interviewed\s*1 · 50%/,
      /Offers\s*0 · 0%/,
      /Accepted\s*0 · 0%/,
    ]);
    await expect(group(page, /^By source$/).getByRole("row", { name: /Job board/ })).toContainText("2");
  });
});

test("download the list as a CSV that Excel reads as Arabic", async ({ page }) => {
  await addApplication(page, "فودافون مصر");
  await addApplication(page, "Instabug");

  // Filtered to one company: the file has only that one.
  await page.goto("/en/applications?view=list&company=" + encodeURIComponent("فودافون"));
  await expect(page.getByRole("status")).toHaveText("1 application", AUTH_TIMEOUT);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  const file = await readFile(await download.path());
  // The UTF-8 byte order mark is what makes Excel show Arabic instead of garbage.
  expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = file.toString("utf8");
  expect(text).toContain("فودافون مصر");
  expect(text).not.toContain("Instabug");
});
