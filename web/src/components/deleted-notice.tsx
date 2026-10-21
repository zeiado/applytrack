"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { FormSuccess } from "@/components/auth/form-parts";

/** After deleting an account, the home page says it's done. */
export function DeletedNotice() {
  const t = useTranslations("Home");
  if (useSearchParams().get("deleted") !== "1") return null;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4">
      <FormSuccess>{t("deleted")}</FormSuccess>
    </div>
  );
}
