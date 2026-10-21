import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "correct-horse-battery";
// Signing up or in hashes a password with Argon2 on purpose slowly; with several
// tests at once on one API process, that can take a few seconds.
const AUTH_TIMEOUT = { timeout: 30_000 };

/** Our form messages (Next.js has its own hidden role="alert" route announcer). */
function formAlert(page: Page) {
  return page.locator('[data-slot="alert"]');
}

function newEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** The dashboard's greeting. The email is wrapped in Unicode direction marks, so it
 * displays correctly inside Arabic text. */
function welcome(page: Page, email: string) {
  return page.getByRole("heading", { name: `Welcome, ⁨${email}⁩` });
}

async function register(page: Page, email: string) {
  await page.goto("/en/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, AUTH_TIMEOUT);
}

test("sign up, log out, and log in again", async ({ page }) => {
  const email = newEmail();

  await register(page, email);
  await expect(welcome(page, email)).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toContainText(`we sent a link to ⁨${email}⁩`);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/en$/);

  // The dashboard now asks for a login, and returns there after it.
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(formAlert(page)).toHaveText("That email and password don't match.", AUTH_TIMEOUT);

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/, AUTH_TIMEOUT);
  await expect(welcome(page, email)).toBeVisible();
});

test("tokens stay out of reach of page scripts", async ({ page, context }) => {
  await register(page, newEmail());

  const cookies = await context.cookies();
  for (const name of ["__Host-at", "__Host-rt"]) {
    expect(cookies.find((c) => c.name === name)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
    });
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain("__Host-");
});

test("an expired access token is replaced without logging out", async ({ page, context }) => {
  const email = newEmail();
  await register(page, email);
  const before = (await context.cookies()).find((c) => c.name === "__Host-rt")?.value;

  // The access cookie expires before the refresh cookie; simulate that.
  await context.clearCookies({ name: "__Host-at" });
  await page.reload();

  await expect(welcome(page, email)).toBeVisible();
  const after = await context.cookies();
  expect(after.find((c) => c.name === "__Host-at")).toBeDefined();
  expect(after.find((c) => c.name === "__Host-rt")?.value).not.toBe(before);
});

test("logged-in visitors skip the login page", async ({ page }) => {
  await register(page, newEmail());

  await page.goto("/en/login");

  await expect(page).toHaveURL(/\/en\/dashboard$/, AUTH_TIMEOUT);
});

test("signing up with an email that's taken explains what to do", async ({ page, browser }) => {
  const email = newEmail();
  await register(page, email);

  const visitor = await browser.newPage();
  await visitor.goto("/en/register");
  await visitor.getByLabel("Email").fill(email);
  await visitor.getByLabel("Password").fill(PASSWORD);
  await visitor.getByRole("button", { name: "Create account" }).click();

  await expect(formAlert(visitor)).toHaveText(
    "An account with this email already exists. Log in instead.",
    AUTH_TIMEOUT,
  );
  await visitor.close();
});

test("forgot password always says the email is on its way", async ({ page }) => {
  await page.goto("/en/forgot-password");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByRole("button", { name: "Send the link" }).click();

  await expect(formAlert(page)).toContainText("a link to reset the password is on its way");
});

test("a reset link without its token says so", async ({ page }) => {
  await page.goto("/en/reset-password");

  await expect(page.getByText("This link is incomplete.")).toBeVisible();
});

test("the Arabic login page reads right to left", async ({ page }) => {
  await page.goto("/ar/login");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
});
