import { expect, test } from "@playwright/test";

import { AUTH_TIMEOUT, register } from "./helpers";

test("fill in the profile from settings, and it's kept", async ({ page }) => {
  await register(page);
  await page.goto("/en/settings");
  await page.getByRole("link", { name: "Edit your profile" }).click();
  await expect(page).toHaveURL(/\/en\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your profile" })).toBeVisible();

  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Headline").fill("Final-year computer science student");
  await page.getByLabel("City").fill("Cairo");
  await page.getByLabel("Education").fill("BSc Computer Science, Cairo University, 2026");
  await page.getByLabel("Experience").selectOption("student");
  await page.getByLabel("Skills").fill("Python, SQL، python, Excel");
  await page.getByLabel("Languages").fill("Arabic, English");
  await page.getByLabel("Open to recruiters").check();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.", AUTH_TIMEOUT);

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Experience")).toHaveValue("student");
  // Skills are chips now: one each, duplicates (in any case) dropped.
  for (const skill of ["Python", "SQL", "Excel"]) {
    await expect(page.getByRole("button", { name: `Remove ${skill}`, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(5); // and Arabic, English
  await expect(page.getByLabel("Open to recruiters")).toBeChecked();

  // Emptying a field clears it.
  await page.getByLabel("City").fill("");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.", AUTH_TIMEOUT);
  await page.reload();
  await expect(page.getByLabel("City")).toHaveValue("");
});

test("the profile page in Arabic", async ({ page }) => {
  await register(page, undefined, "ar");
  await page.goto("/ar/profile");
  await expect(page.getByRole("heading", { level: 1, name: "بروفايلك" })).toBeVisible();
  await expect(page.getByLabel("متاح لأصحاب الشغل")).not.toBeChecked();
});

test("the sidebar links to the profile from any page", async ({ page }) => {
  await register(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Your profile" }).click();
  await expect(page).toHaveURL(/\/en\/profile$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Your profile" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("needs a login", async ({ page }) => {
  await page.goto("/en/profile");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fprofile$/);
});
