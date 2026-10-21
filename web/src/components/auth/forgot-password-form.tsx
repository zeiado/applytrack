"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/lib/auth/actions";

import { Field, FormError, FormSuccess, SubmitButton } from "./form-parts";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="grid gap-4">
      {state?.ok ? (
        <FormSuccess>{t("forgot.sent")}</FormSuccess>
      ) : (
        <form action={action} className="grid gap-4">
          <Field
            id="email"
            name="email"
            type="email"
            label={t("email")}
            autoComplete="email"
            defaultValue={state?.email}
            required
          />
          <FormError error={state?.error} />
          <SubmitButton>{t("forgot.submit")}</SubmitButton>
        </form>
      )}
      <Link href="/login" className="text-primary text-center text-sm hover:underline">
        {t("forgot.back")}
      </Link>
    </div>
  );
}
