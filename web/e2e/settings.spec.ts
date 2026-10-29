import { expect, type Page, test } from "@playwright/test";

import { AUTH_TIMEOUT, formAlert, PASSWORD, register } from "./helpers";

function section(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title, level: 2, exact: true }) });
}

async function openSettings(page: Page) {
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await register(page);
});

test("shows the account and changes preferences", async ({ page }) => {
  await openSettings(page);
  const account = section(page, "Account");
  await expect(account).toContainText("Not confirmed yet");
  await expect(account).toContainText("Password");

  const preferences = section(page, "Preferences");
  await preferences.getByLabel("Email language").selectOption("ar");
  await preferences.getByLabel("Timezone").selectOption("Asia/Riyadh");
  await preferences.getByLabel("Morning reminder email").uncheck();
  await preferences.getByRole("button", { name: "Save preferences" }).click();
  await expect(preferences.getByRole("status")).toHaveText("Saved.", AUTH_TIMEOUT);

  await page.reload();
  await expect(preferences.getByLabel("Email language")).toHaveValue("ar");
  await expect(preferences.getByLabel("Timezone")).toHaveValue("Asia/Riyadh");
  await expect(preferences.getByLabel("Morning reminder email")).not.toBeChecked();
});

test("interview times follow the timezone setting", async ({ page }) => {
  await page.goto("/en/applications/new");
  await page.getByLabel("Company").fill("Instabug");
  await page.getByLabel("Role").fill("Backend Engineer");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
  await page.getByRole("link", { name: "Instabug" }).click();
  const interviews = section(page, "Interviews");
  await interviews.getByRole("button", { name: "Add interview" }).click();
  // 14:00 in Cairo (the default), in summer: 11:00 UTC.
  await interviews.getByLabel("Date and time").fill("2030-07-01T14:00");
  await interviews.getByRole("button", { name: "Save interview" }).click();
  await expect(interviews.locator("article")).toContainText("2:00", AUTH_TIMEOUT);
  const applicationUrl = page.url();

  // The application opened in the side panel over the board; close it to reach the sidebar.
  await page.keyboard.press("Escape");
  await openSettings(page);
  await section(page, "Preferences").getByLabel("Timezone").selectOption("UTC");
  await section(page, "Preferences").getByRole("button", { name: "Save preferences" }).click();
  await expect(section(page, "Preferences").getByRole("status")).toHaveText("Saved.", AUTH_TIMEOUT);

  await page.goto(applicationUrl);
  await expect(section(page, "Interviews").locator("article")).toContainText("11:00");
});

test("download my data", async ({ page }) => {
  await openSettings(page);

  const download = page.waitForEvent("download");
  await section(page, "Your data").getByRole("link", { name: "Download my data" }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^applytrack-export-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
  expect(data.user.email).toMatch(/@example\.com$/);
  expect(data.applications).toEqual([]);
});

test("the data download needs a login", async ({ browser }) => {
  const visitor = await browser.newPage();
  await visitor.goto("/api/account/export");

  await expect(visitor).toHaveURL(/\/login\?next=%2Fsettings$/);
  await visitor.close();
});

test("delete the account, confirmed with the password", async ({ page }) => {
  await openSettings(page);
  const danger = section(page, "Delete account");
  await danger.getByRole("button", { name: "Delete my account" }).click();

  await danger.getByLabel("Enter your password to confirm").fill("not-my-password");
  await danger.getByRole("button", { name: "Delete my account forever" }).click();
  await expect(formAlert(page).filter({ hasText: "isn't right" })).toBeVisible(AUTH_TIMEOUT);

  await danger.getByLabel("Enter your password to confirm").fill(PASSWORD);
  await danger.getByRole("button", { name: "Delete my account forever" }).click();
  await expect(page).toHaveURL(/\/en\?deleted=1$/, AUTH_TIMEOUT);
  // (Next.js keeps the previous page hidden in the document, so filter by text.)
  await expect(formAlert(page).filter({ hasText: "have been deleted" })).toBeVisible();

  // Logged out, and the account is gone.
  await page.goto("/en/applications");
  await expect(page).toHaveURL(/\/en\/login/);
});
