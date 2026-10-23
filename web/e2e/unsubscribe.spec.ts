import { createHmac } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { formAlert, register } from "./helpers";

// The e2e API runs with the development secret (see playwright.config.ts), so the test
// can make the same token a reminder email would carry (core/security.py).
const DEV_SECRET = "dev-only-insecure-secret-change-me-0123456789";

async function unsubscribeToken(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "__Host-at");
  if (!cookie) throw new Error("not logged in");
  const claims = JSON.parse(Buffer.from(cookie.value.split(".")[1] ?? "", "base64url").toString());
  const userId = String(claims.sub).replaceAll("-", "");
  const signature = createHmac("sha256", DEV_SECRET)
    .update(Buffer.concat([Buffer.from("unsubscribe-reminders:"), Buffer.from(userId, "hex")]))
    .digest()
    .subarray(0, 16)
    .toString("base64url");
  return `${userId}.${signature}`;
}

test("the link in a reminder email turns reminders off", async ({ page }) => {
  await register(page);
  const token = await unsubscribeToken(page);

  await page.goto(`/en/unsubscribe#token=${token}`);
  await expect(page.getByRole("heading", { name: "Stop reminder emails?" })).toBeVisible();
  await page.getByRole("button", { name: "Stop reminder emails" }).click();
  await expect(formAlert(page)).toContainText("You won't get reminder emails any more.");

  await page.getByRole("link", { name: "Turn them back on in settings" }).click();
  await expect(page.getByLabel("Morning reminder email")).not.toBeChecked();
});

test("opening the page alone changes nothing", async ({ page }) => {
  await register(page);
  await page.goto(`/en/unsubscribe#token=${await unsubscribeToken(page)}`);
  await expect(page.getByRole("button", { name: "Stop reminder emails" })).toBeVisible();

  await page.goto("/en/settings");
  await expect(page.getByLabel("Morning reminder email")).toBeChecked();
});

test("a bad link says so", async ({ page }) => {
  await page.goto("/en/unsubscribe#token=nonsense");
  await page.getByRole("button", { name: "Stop reminder emails" }).click();
  await expect(formAlert(page)).toContainText("This unsubscribe link isn't valid.");
});
