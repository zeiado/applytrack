import { expect, test } from "@playwright/test";

import { register } from "./helpers";

// The link is built into the app, so this runs when the build had a form set (CI does).
const FORM = process.env.NEXT_PUBLIC_FEEDBACK_URL;

test("the sidebar and settings link to the feedback form", async ({ page }) => {
  test.skip(!FORM, "NEXT_PUBLIC_FEEDBACK_URL wasn't set for the build");
  await register(page);

  const header = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Feedback" });
  await expect(header).toHaveAttribute("href", FORM!);
  await expect(header).toHaveAttribute("target", "_blank");

  await page.goto("/en/settings");
  await expect(page.getByRole("link", { name: "Send feedback" })).toHaveAttribute("href", FORM!);

  await page.goto("/ar/settings");
  await expect(page.getByRole("link", { name: "ابعت رأيك" })).toHaveAttribute("href", FORM!);
});
