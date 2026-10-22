import { expect, test } from "@playwright/test";

import { AUTH_TIMEOUT, register } from "./helpers";

test("the manifest makes it installable", async ({ page, request }) => {
  await page.goto("/en");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const manifest = await (await request.get(href as string)).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/applications", scope: "/" });
  // Chrome needs a 192px and a 512px icon; Android's adaptive icons need a maskable one.
  const sizes = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }

  // iPhone and iPad read their own tags.
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveCount(1);
});

test("offline, pages show the offline page", async ({ page, context }) => {
  await page.goto("/en");
  // The service worker takes control of the page once it's active.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve));
    }
  });

  await context.setOffline(true);
  await page.goto("/en/login").catch(() => {});
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "إنت مش متوصل بالنت" })).toBeVisible();

  // Back online, the page opens by itself.
  await context.setOffline(false);
  await expect(page.locator("#email")).toBeVisible(AUTH_TIMEOUT);
  await expect(page.getByRole("heading", { name: "You're offline" })).toHaveCount(0);
});

test("settings explain how to install it", async ({ page }) => {
  await register(page);
  await page.goto("/en/settings");
  const app = page.locator("section").filter({ has: page.getByRole("heading", { name: "App", level: 2 }) });
  await expect(app).toContainText("Add Sekka to your home screen", AUTH_TIMEOUT);
});
