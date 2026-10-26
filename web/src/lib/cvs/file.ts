import type { components } from "@/lib/api/schema";

export type Cv = components["schemas"]["CVRead"];

export const PDF = "application/pdf";
export const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export type CvContentType = typeof PDF | typeof DOCX;

export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const MAX_CVS = 3;
/** For the file picker. */
export const CV_ACCEPT = `.pdf,.docx,${PDF},${DOCX}`;

/** The reasons the API gives for a CV it couldn't read. */
export const CV_READ_ERRORS = ["wrong_type", "encrypted", "unreadable", "no_text", "storage_error"] as const;

export type CvCheck = { contentType: CvContentType } | { error: "cv_type" | "cv_too_big" | "cv_empty" };

/** Checks a picked file before uploading. The type comes from the name, because
 * browsers sometimes leave `file.type` empty (Word files on some systems). */
export function checkCvFile(file: { name: string; size: number }): CvCheck {
  const extension = file.name.toLowerCase().split(".").pop();
  const contentType = extension === "pdf" ? PDF : extension === "docx" ? DOCX : null;
  if (!contentType) return { error: "cv_type" };
  if (file.size === 0) return { error: "cv_empty" };
  if (file.size > MAX_CV_BYTES) return { error: "cv_too_big" };
  return { contentType };
}

/** "1.2 MB" or "350 KB", in the page's language. */
export function formatSize(bytes: number, locale: string): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    maximumFractionDigits: mb ? 1 : 0,
  }).format(mb ? bytes / (1024 * 1024) : Math.max(1, Math.round(bytes / 1024)));
}

export function isWordFile(cv: Pick<Cv, "content_type">): boolean {
  return cv.content_type === DOCX;
}
