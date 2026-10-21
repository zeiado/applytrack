import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery";
// Signing up or in hashes a password with Argon2 on purpose slowly; the first request
// after the servers start can also take a few seconds.
export const AUTH_TIMEOUT = { timeout: 30_000 };

export function newEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Our form messages (Next.js has its own hidden role="alert" route announcer). */
export function formAlert(page: Page) {
  return page.locator('[data-slot="alert"]');
}

/** The "confirm your email" banner names the logged-in user, so it shows who that is.
 * The email is wrapped in Unicode direction marks, so it reads right inside Arabic. */
export function signedInAs(page: Page, email: string) {
  return formAlert(page).filter({ hasText: `⁨${email}⁩` });
}

export async function register(page: Page, email: string = newEmail(), locale = "en") {
  await page.goto(`/${locale}/register`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/applications$`), AUTH_TIMEOUT);
  return email;
}
