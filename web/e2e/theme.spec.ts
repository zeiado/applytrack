import { expect, test } from "@playwright/test";

import { register } from "./helpers";

const html = (page: import("@playwright/test").Page) => page.locator("html");

test("follows the device until light or dark is chosen in settings", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en");
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await register(page);
  await page.goto("/en/settings");
  const appearance = page.getByRole("group", { name: "Appearance" });
  await expect(appearance.getByRole("radio", { name: "System" })).toBeChecked();

  await appearance.getByText("Light", { exact: true }).click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await expect(html(page)).toHaveCSS("color-scheme", "light");

  // Remembered, and applied before the page shows.
  await page.reload();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await expect(appearance.getByRole("radio", { name: "Light" })).toBeChecked();

  await page.emulateMedia({ colorScheme: "light" });
  await appearance.getByText("Dark", { exact: true }).click();
  await page.goto("/ar/applications");
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.goto("/en/settings");
  await appearance.getByText("System", { exact: true }).click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
});
