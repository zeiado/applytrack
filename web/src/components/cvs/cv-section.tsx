"use client";

import { CircleAlert, CircleCheck, Download, FileText, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { FormError } from "@/components/auth/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionError } from "@/lib/auth/errors";
import { completeCvUpload, deleteCv, startCvUpload } from "@/lib/cvs/actions";
import { CV_ACCEPT, CV_READ_ERRORS, checkCvFile, type Cv, formatSize, isWordFile, MAX_CVS } from "@/lib/cvs/file";

// While a CV is being read, check every few seconds (it usually takes one or two).
const POLL_MS = 2500;
const POLL_FOR_MS = 2 * 60 * 1000;

/** Upload, replace, download and delete CVs (#115). Files go straight from the browser
 * to storage with a signed link; the API reads their text in the background. */
export function CvSection({ cvs }: { cvs: Cv[] }) {
  const t = useTranslations("Cvs");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError>();

  const reading = cvs.some((cv) => cv.status === "processing");
  useEffect(() => {
    if (!reading) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) clearInterval(timer);
      else router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reading, router]);

  function pick(replaces?: string) {
    setReplacing(replaces);
    setError(undefined);
    input.current?.click();
  }

  async function upload(file: File) {
    const checked = checkCvFile(file);
    if ("error" in checked) return setError({ code: checked.error });
    setBusy(true);
    setError(undefined);
    try {
      const start = await startCvUpload({
        filename: file.name,
        contentType: checked.contentType,
        size: file.size,
        replaces: replacing,
      });
      if ("error" in start) return setError(start.error);
      let uploaded = false;
      try {
        const response = await fetch(start.url, { method: "PUT", headers: start.headers, body: file });
        uploaded = response.ok;
      } catch {
        // offline, or storage refused the request: handled below
      }
      if (!uploaded) {
        await deleteCv(start.id);
        return setError({ code: "upload_failed" });
      }
      const done = await completeCvUpload(start.id);
      if ("error" in done) setError(done.error);
    } finally {
      setBusy(false);
      setReplacing(undefined);
    }
  }

  return (
    <section aria-labelledby="cvs-title" className="grid gap-4">
      <header className="grid gap-1">
        <h2 id="cvs-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("description", { max: MAX_CVS })}</p>
      </header>

      {cvs.length > 0 && (
        <ul className="grid gap-3">
          {cvs.map((cv) => (
            <CvItem key={cv.id} cv={cv} busy={busy} onReplace={() => pick(cv.id)} />
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept={CV_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("choose")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ""; // picking the same file again still fires onChange
          if (file) void upload(file);
        }}
      />

      {busy ? (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {t("uploading")}
        </p>
      ) : (
        cvs.length < MAX_CVS && (
          <div>
            <Button className="h-10" onClick={() => pick()}>
              <Upload aria-hidden />
              {cvs.length ? t("uploadAnother") : t("upload")}
            </Button>
          </div>
        )
      )}
      {!busy && cvs.length >= MAX_CVS && <p className="text-muted-foreground text-sm">{t("limit", { max: MAX_CVS })}</p>}
      <FormError error={error} />
    </section>
  );
}

function CvItem({ cv, busy, onReplace }: { cv: Cv; busy: boolean; onReplace: () => void }) {
  const t = useTranslations("Cvs");
  const format = useFormatter();
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ActionError>();
  const [deleting, startDelete] = useTransition();
  const uploaded = cv.status !== "uploading";

  return (
    <li className="bg-card grid grid-cols-1 gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <FileText aria-hidden className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="truncate font-medium" dir="auto" title={cv.filename}>
            {cv.filename}
          </p>
          <p className="text-muted-foreground text-xs">
            {isWordFile(cv) ? "Word" : "PDF"} · {formatSize(cv.size_bytes, locale)} ·{" "}
            {format.dateTime(new Date(cv.created_at), { dateStyle: "medium" })}
          </p>
          <CvStatus cv={cv} />
        </div>
      </div>

      {confirming ? (
        <div className="border-destructive/30 grid gap-3 rounded-lg border p-3" role="alertdialog" aria-labelledby={`delete-${cv.id}`}>
          <p id={`delete-${cv.id}`} className="text-sm">
            {t("deleteWarning")}
          </p>
          <FormError error={error} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              className="h-9"
              disabled={deleting}
              autoFocus
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteCv(cv.id);
                  if ("error" in result) setError(result.error);
                })
              }
            >
              {t("deleteConfirm")}
            </Button>
            <Button variant="ghost" className="h-9" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {uploaded && (
            <a
              href={`/api/cvs/${cv.id}/download`}
              aria-label={t("downloadNamed", { name: cv.filename })}
              className={buttonVariants({ variant: "outline", className: "h-9" })}
            >
              <Download aria-hidden />
              {t("download")}
            </a>
          )}
          <Button variant="outline" className="h-9" disabled={busy} onClick={onReplace} aria-label={t("replaceNamed", { name: cv.filename })}>
            <RefreshCw aria-hidden />
            {t("replace")}
          </Button>
          <Button variant="ghost" className="text-destructive h-9" onClick={() => setConfirming(true)} aria-label={t("deleteNamed", { name: cv.filename })}>
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        </div>
      )}
    </li>
  );
}

function CvStatus({ cv }: { cv: Cv }) {
  const t = useTranslations("Cvs");
  if (cv.status === "ready") {
    return (
      <p className="text-primary flex items-center gap-1.5 text-sm">
        <CircleCheck aria-hidden className="size-4" />
        {t("status.ready")}
      </p>
    );
  }
  if (cv.status === "failed") {
    const reason = (CV_READ_ERRORS as readonly string[]).includes(cv.error ?? "") ? cv.error! : "unreadable";
    return (
      <p className="text-destructive flex items-start gap-1.5 text-sm">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t(`readErrors.${reason as (typeof CV_READ_ERRORS)[number]}`)}
      </p>
    );
  }
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-sm" role="status">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {cv.status === "processing" ? t("status.processing") : t("status.uploading")}
    </p>
  );
}
