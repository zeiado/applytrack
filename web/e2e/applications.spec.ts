import { expect, type Page, test } from "@playwright/test";

import { AUTH_TIMEOUT, formAlert, register } from "./helpers";

/** A board column, by its status name ("Applied 2" → /^Applied/). */
function column(page: Page, status: string) {
  return page.getByRole("region", { name: new RegExp(`^${status}`) });
}

async function addApplication(
  page: Page,
  fields: { company: string; role: string; wishlist?: boolean; followUp?: string },
) {
  await page.getByRole("link", { name: "Add application" }).first().click();
  await expect(page).toHaveURL(/\/en\/applications\/new$/);
  await page.getByLabel("Company").fill(fields.company);
  await page.getByLabel("Role").fill(fields.role);
  if (fields.wishlist) await page.getByLabel("Stage").selectOption("wishlist");
  if (fields.followUp) await page.getByLabel(/Follow up on/).fill(fields.followUp);
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
}

test.beforeEach(async ({ page }) => {
  await register(page);
});

test("a new account sees how to start", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "No applications yet" })).toBeVisible();
});

test("add applications and see them in their columns", async ({ page }) => {
  await addApplication(page, { company: "Instabug", role: "Backend Engineer" });
  await addApplication(page, { company: "Valeo", role: "Embedded Intern", wishlist: true });

  await expect(column(page, "Applied").getByRole("heading", { name: "Instabug" })).toBeVisible();
  await expect(column(page, "Applied")).toContainText("Backend Engineer");
  await expect(column(page, "Wishlist").getByRole("heading", { name: "Valeo" })).toBeVisible();
  await expect(column(page, "Applied")).toHaveAccessibleName(/^Applied\s*1$/);
});

test("move a card, using only the moves its stage allows", async ({ page }) => {
  await addApplication(page, { company: "Swvl", role: "Data Analyst" });

  await page.getByRole("button", { name: "Move Swvl" }).click();
  const menu = page.getByRole("menu");
  // From "applied": screening, interviewing, rejected or withdrawn; never straight to an offer.
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Screening",
    "Interviewing",
    "Rejected",
    "Withdrawn",
    "Edit",
  ]);
  await menu.getByRole("menuitem", { name: "Screening" }).click();

  await expect(column(page, "Screening").getByRole("heading", { name: "Swvl" })).toBeVisible();
  await expect(column(page, "Applied").getByRole("heading", { name: "Swvl" })).toHaveCount(0);
  // Still there after a reload: it was saved.
  await page.reload();
  await expect(column(page, "Screening").getByRole("heading", { name: "Swvl" })).toBeVisible();
});

test("a final status offers no more moves", async ({ page }) => {
  await addApplication(page, { company: "Fawry", role: "QA Engineer" });
  await page.getByRole("button", { name: "Move Fawry" }).click();
  await page.getByRole("menuitem", { name: "Rejected" }).click();
  await expect(column(page, "Rejected").getByRole("heading", { name: "Fawry" })).toBeVisible();

  await page.getByRole("button", { name: "Move Fawry" }).click();

  await expect(page.getByRole("menu")).toContainText("Final status");
  await expect(page.getByRole("menuitem")).toHaveText(["Edit"]);
});

test("edit an application", async ({ page }) => {
  await addApplication(page, { company: "Paymob", role: "Frontend Engineer" });

  await page.getByRole("link", { name: "Paymob" }).click();
  await expect(page.getByRole("heading", { name: "Edit application" })).toBeVisible();
  await page.getByLabel("Role").fill("Senior Frontend Engineer");
  await page.getByLabel("From").fill("40,000");
  await page.getByLabel("To").fill("55000");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
  await expect(column(page, "Applied")).toContainText("Senior Frontend Engineer");
  await page.getByRole("link", { name: "Paymob" }).click();
  await expect(page.getByLabel("From")).toHaveValue("40000");
});

test("mistakes are pointed out and nothing typed is lost", async ({ page }) => {
  await page.getByRole("link", { name: "Add application" }).first().click();
  await page.getByLabel("Company").fill("Breadfast");
  await page.getByLabel("Role").fill("Ops Analyst");
  await page.getByLabel("From").fill("30000");
  await page.getByLabel("To").fill("20000");
  await page.getByRole("button", { name: "Add application" }).click();

  await expect(page.getByText("Enter a whole number at least as big as “From”.")).toBeVisible(AUTH_TIMEOUT);
  await expect(page.getByLabel("To")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Company")).toHaveValue("Breadfast");
  await expect(page.getByLabel("From")).toHaveValue("30000");
  await expect(formAlert(page).filter({ hasText: "Check the fields" })).toBeVisible();
});

test("the list filters by status and company", async ({ page }) => {
  await addApplication(page, { company: "Vodafone", role: "Network Engineer" });
  await addApplication(page, { company: "Orange", role: "Sales", wishlist: true });
  await addApplication(page, { company: "Vodafone Intl", role: "Support", wishlist: true });

  await page.getByRole("link", { name: "List" }).click();
  await expect(page.getByRole("status")).toHaveText("3 applications");

  await page.getByLabel("Company").fill("vodafone");
  await page.getByRole("checkbox", { name: "Wishlist" }).check();
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/status=wishlist/);
  const url = new URL(page.url());
  expect(url.searchParams.get("view")).toBe("list");
  expect(url.searchParams.getAll("status")).toEqual(["wishlist"]);
  expect(url.searchParams.get("company")).toBe("vodafone");
  await expect(page.getByRole("status")).toHaveText("1 application");
  await expect(page.getByRole("table")).toContainText("Vodafone Intl");
  await expect(page.getByRole("table")).not.toContainText("Orange");

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("status")).toHaveText("3 applications");
});

test("delete an application after confirming", async ({ page }) => {
  await addApplication(page, { company: "Halan", role: "Product Manager" });
  await page.getByRole("link", { name: "Halan" }).click();

  await page.getByRole("button", { name: "Delete application" }).click();
  await expect(page.getByText("It can't be undone.")).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete it" }).click();

  await expect(page).toHaveURL(/\/en\/applications$/, AUTH_TIMEOUT);
  await expect(page.getByRole("heading", { name: "No applications yet" })).toBeVisible();
});

test("an overdue follow-up stands out", async ({ page }) => {
  await addApplication(page, { company: "Rabbit", role: "Ops Lead", followUp: "2026-01-05" });

  await expect(column(page, "Applied")).toContainText("Follow-up overdue");
});

test("the board in Arabic reads right to left", async ({ page }) => {
  await addApplication(page, { company: "Instabug", role: "Backend Engineer" });

  await page.goto("/ar/applications");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("الطلبات");
  await expect(column(page, "تم التقديم").getByRole("heading", { name: "Instabug" })).toBeVisible();
});
