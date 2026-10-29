"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { quickCreate } from "@/lib/applications/actions";

const FIELD = "border-input focus-visible:border-primary h-9 rounded-xs border bg-transparent px-2.5 text-sm outline-none";

/** "+ New" at the bottom of a board column, Notion style: type the company and the role,
 * press Enter, and the card appears in this column. Esc or "Cancel" closes it. */
export function QuickAdd({ status, today, label }: { status: "wishlist" | "applied"; today: string; label: string }) {
  const t = useTranslations("Applications.quickAdd");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground justify-start"
        onClick={() => setOpen(true)}
        data-icon="inline-start"
      >
        <Plus aria-hidden />
        <span aria-hidden>{t("new")}</span>
        <span className="sr-only">{label}</span>
      </Button>
    );
  }

  return (
    <form
      ref={form}
      aria-label={label}
      className="bg-card grid gap-2 rounded-xl border p-3"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      action={(data) => {
        const company = String(data.get("company") ?? "").trim();
        const role = String(data.get("role_title") ?? "").trim();
        if (!company || !role) return;
        startTransition(async () => {
          const result = await quickCreate(status, company, role, today);
          if ("error" in result) {
            toast.add({ title: t("failed") });
            return;
          }
          toast.add({ title: t("added", { company }) });
          form.current?.reset();
          (form.current?.elements.namedItem("company") as HTMLInputElement | null)?.focus();
        });
      }}
    >
      <input name="company" aria-label={t("company")} placeholder={t("company")} autoFocus required maxLength={200} className={FIELD} />
      <input name="role_title" aria-label={t("role")} placeholder={t("role")} required maxLength={200} className={FIELD} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t("add")}
        </Button>
        <Button type="button" variant="text" size="sm" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
