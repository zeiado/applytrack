import { expect, type Page, test } from "@playwright/test";

import { AUTH_TIMEOUT, register } from "./helpers";

function guide(page: Page) {
  return page.getByRole("region", { name: "Get started" });
}

test.beforeEach(async ({ page }) => {
  await register(page);
});

test("the guide ticks off each step and goes away once a follow-up is set", async ({ page }) => {
  await expect(guide(page)).toContainText("0 of 2 done");
  await guide(page).getByRole("link", { name: "Add an application" }).click();
  await page.getByLabel("Company").fill("Paymob");
  await page.getByLabel("Role").fill("Data Analyst");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);

  await expect(guide(page)).toContainText("1 of 2 done");
  await expect(guide(page).getByRole("listitem").first()).toContainText("Done");
  await guide(page).getByRole("link", { name: "Set a date" }).click();
  await expect(page).toHaveURL(/\/en\/applications\/[\w-]+#follow_up_on$/);

  const followUp = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Follow-up", level: 2 }) });
  await followUp.getByLabel("Follow up on").fill("2030-01-05");
  await followUp.getByRole("button", { name: "Save date" }).click();
  await expect(followUp.getByRole("status")).toHaveText("Saved.", AUTH_TIMEOUT);

  // Clearing the date later doesn't bring the guide back.
  await followUp.getByRole("button", { name: "Clear" }).click();
  await expect(followUp.getByLabel("Follow up on")).toHaveValue("", AUTH_TIMEOUT);
  await page.goto("/en/applications");
  await expect(page.getByRole("heading", { name: "Paymob" })).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
});

test("the guide can be hidden", async ({ page }) => {
  await guide(page).getByRole("button", { name: "Hide" }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No applications yet" })).toBeVisible();
  await page.reload();
  await expect(guide(page)).toHaveCount(0);
});

test("in Arabic", async ({ page }) => {
  await page.goto("/ar/applications");
  await expect(page.getByRole("region", { name: "ابدأ من هنا" })).toContainText("خلّصت 0 من 2");
});
