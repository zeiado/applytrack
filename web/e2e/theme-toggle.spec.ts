import { expect, test } from "@playwright/test";

import { register } from "./helpers";

test("the header button switches between light and dark on any page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/en");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  // Logged in, in Arabic: the same button, now offering light.
  await register(page);
  await page.goto("/ar/applications");
  await page.getByRole("button", { name: "حوّل للشكل الفاتح" }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);

  // Settings shows the choice the button made.
  await page.goto("/en/settings");
  await expect(page.getByRole("group", { name: "Appearance" }).getByRole("radio", { name: "Light" })).toBeChecked();
});

test("sign-in pages on a phone have it too", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
