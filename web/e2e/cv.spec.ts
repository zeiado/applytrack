import { expect, type Page, test } from "@playwright/test";

import { AUTH_TIMEOUT, register } from "./helpers";

/** A one-page PDF showing `text`. */
function pdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function choose(page: Page, button: RegExp | string, file: { name: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button }).click();
  await (await chooser).setFiles({ name: file.name, mimeType: "application/pdf", buffer: file.buffer });
}

test("upload a CV, see it read, replace, download and delete it", async ({ page }) => {
  await register(page);
  await page.goto("/en/profile");
  await expect(page.getByRole("heading", { level: 2, name: "Your CV" })).toBeVisible();

  await choose(page, "Upload your CV", { name: "Ada CV.pdf", buffer: pdf("Python developer") });
  const item = page.getByRole("listitem").filter({ hasText: "Ada CV.pdf" });
  await expect(item).toBeVisible(AUTH_TIMEOUT);
  // The worker reads it in the background; the page checks until it's done.
  await expect(item.getByText("Ready for Sekka AI")).toBeVisible(AUTH_TIMEOUT);

  const download = page.waitForEvent("download");
  await item.getByRole("link", { name: "Download Ada CV.pdf" }).click();
  expect((await download).suggestedFilename()).toBe("Ada CV.pdf");

  await choose(page, "Replace Ada CV.pdf", { name: "New CV.pdf", buffer: pdf("Data analyst") });
  const replaced = page.getByRole("listitem").filter({ hasText: "New CV.pdf" });
  await expect(replaced.getByText("Ready for Sekka AI")).toBeVisible(AUTH_TIMEOUT);
  await expect(item).toHaveCount(0);

  await replaced.getByRole("button", { name: "Delete New CV.pdf" }).click();
  await page.getByRole("button", { name: "Delete it" }).click();
  await expect(replaced).toHaveCount(0, AUTH_TIMEOUT);
  await expect(page.getByRole("button", { name: "Upload your CV" })).toBeVisible();
});

test("files that aren't PDF or Word are refused before uploading", async ({ page }) => {
  await register(page);
  await page.goto("/en/profile");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload your CV" }).click();
  await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("png") });
  await expect(page.getByText("Choose a PDF or Word (.docx) file.")).toBeVisible();
});

test("the CV section in Arabic", async ({ page }) => {
  await register(page, undefined, "ar");
  await page.goto("/ar/profile");
  await expect(page.getByRole("heading", { level: 2, name: "الـ CV بتاعك" })).toBeVisible();
  await choose(page, "ارفع الـ CV بتاعك", { name: "سيرة.pdf", buffer: pdf("Hello") });
  const item = page.getByRole("listitem").filter({ hasText: "سيرة.pdf" });
  await expect(item.getByText("جاهز، وSekka AI يقدر يستخدمه")).toBeVisible(AUTH_TIMEOUT);
});
