import { expect, test } from "@playwright/test";

import { AUTH_TIMEOUT, formAlert, newEmail, PASSWORD, register, signedInAs } from "./helpers";

test("sign up, log out, and log in again", async ({ page }) => {
  const email = await register(page);
  await expect(signedInAs(page, email)).toContainText("we sent a link to");

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/en$/);

  // Applications now ask for a login, and return there after it.
  await page.goto("/en/applications");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fapplications$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(formAlert(page)).toHaveText("That email and password don't match.", AUTH_TIMEOUT);

  // The email is still filled in; only the password needs typing again.
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
  await expect(signedInAs(page, email)).toBeVisible();
});

test("the old dashboard address goes to applications", async ({ page }) => {
  await register(page);

  await page.goto("/en/dashboard");

  await expect(page).toHaveURL(/\/en\/applications$/);
});

test("tokens stay out of reach of page scripts", async ({ page, context }) => {
  await register(page);

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
  const email = await register(page);
  const before = (await context.cookies()).find((c) => c.name === "__Host-rt")?.value;

  // The access cookie expires before the refresh cookie; simulate that.
  await context.clearCookies({ name: "__Host-at" });
  await page.reload();

  await expect(signedInAs(page, email)).toBeVisible();
  const after = await context.cookies();
  expect(after.find((c) => c.name === "__Host-at")).toBeDefined();
  expect(after.find((c) => c.name === "__Host-rt")?.value).not.toBe(before);
});

test("logged-in visitors skip the login page", async ({ page }) => {
  await register(page);

  await page.goto("/en/login");

  await expect(page).toHaveURL(/\/en\/applications$/);
});

test("signing up with an email that's taken explains what to do", async ({ page, browser }) => {
  const email = await register(page);

  const visitor = await browser.newPage();
  await visitor.goto("/en/register");
  await visitor.getByLabel("Email").fill(email);
  await visitor.getByLabel("Password").fill("not-the-password");
  await visitor.getByRole("button", { name: "Create account" }).click();

  await expect(formAlert(visitor)).toHaveText(
    "An account with this email already exists. Log in, or use Continue with Google if you signed up with Google.",
    AUTH_TIMEOUT,
  );
  await visitor.close();
});

test("signing up again with your own email and password logs you in", async ({ page, browser }) => {
  const email = await register(page);

  const again = await browser.newPage();
  await again.goto("/en/register");
  await again.getByLabel("Email").fill(email);
  await again.getByLabel("Password").fill(PASSWORD);
  await again.getByRole("button", { name: "Create account" }).click();

  await expect(again).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
  await again.close();
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
  await expect(page.getByRole("heading", { name: "سجّل دخول" })).toBeVisible();
});
