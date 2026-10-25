import { expect, test } from "@playwright/test";

import { register } from "./helpers";

test("the home page links to the privacy policy and the terms", async ({ page }) => {
  await page.goto("/en");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page).toHaveTitle(/Privacy policy/);

  await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
});

test("both pages read in Arabic, right to left", async ({ page }) => {
  await page.goto("/ar/privacy");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "سياسة الخصوصية" })).toBeVisible();
  await page.goto("/ar/terms");
  await expect(page.getByRole("heading", { level: 1, name: "شروط الاستخدام" })).toBeVisible();
});

test("the list of sections jumps to each one", async ({ page }) => {
  await page.goto("/en/privacy");
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Cookies" }).click();
  await expect(page).toHaveURL(/#cookies$/);
  await expect(page.getByRole("heading", { name: "Cookies" })).toBeInViewport();
});

test("sign-up says what you agree to, and settings links to both", async ({ page }) => {
  await page.goto("/en/register");
  await expect(page.getByText("By creating an account, you agree to")).toBeVisible();
  await expect(page.getByRole("link", { name: "terms of use" })).toHaveAttribute("href", "/en/terms");
  await expect(page.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/en/privacy");

  await register(page);
  await page.goto("/en/settings");
  const legal = page.getByRole("navigation", { name: "Legal" });
  await expect(legal.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy");
  await expect(legal.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/en/terms");
});

test("a logged-in user can still read them", async ({ page }) => {
  await register(page);
  await page.goto("/en/terms");
  await expect(page).toHaveURL(/\/en\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
});
