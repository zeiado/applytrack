import { describe, expect, it } from "vitest";

import { checkCvFile, DOCX, formatSize, MAX_CV_BYTES, PDF } from "./file";

describe("checkCvFile", () => {
  it("takes PDF and Word files by their name", () => {
    expect(checkCvFile({ name: "CV.PDF", size: 10 })).toEqual({ contentType: PDF });
    expect(checkCvFile({ name: "my.cv.docx", size: 10 })).toEqual({ contentType: DOCX });
  });

  it("refuses other types, empty files and files over 5 MB", () => {
    expect(checkCvFile({ name: "cv.doc", size: 10 })).toEqual({ error: "cv_type" });
    expect(checkCvFile({ name: "cv", size: 10 })).toEqual({ error: "cv_type" });
    expect(checkCvFile({ name: "cv.pdf", size: 0 })).toEqual({ error: "cv_empty" });
    expect(checkCvFile({ name: "cv.pdf", size: MAX_CV_BYTES })).toEqual({ contentType: PDF });
    expect(checkCvFile({ name: "cv.pdf", size: MAX_CV_BYTES + 1 })).toEqual({ error: "cv_too_big" });
  });
});

describe("formatSize", () => {
  it("shows kilobytes or megabytes", () => {
    expect(formatSize(350 * 1024, "en")).toBe("350 kB");
    expect(formatSize(100, "en")).toBe("1 kB");
    expect(formatSize(1.25 * 1024 * 1024, "en")).toBe("1.3 MB");
  });
});
