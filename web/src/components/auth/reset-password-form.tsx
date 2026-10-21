"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { resetPassword } from "@/lib/auth/actions";

import { Field, FormError, FormSuccess, SubmitButton } from "./form-parts";
import { useLinkToken } from "./use-link-token";

const LINK_ERRORS: string[] = ["invalid_reset_token", "reset_token_expired"];

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const token = useLinkToken();
  const [state, action] = useActionState(resetPassword, undefined);

  if (token === undefined) return null;
  if (state?.ok) {
    return (
      <div className="grid gap-4">
        <FormSuccess>{t("reset.done")}</FormSuccess>
        <Link href="/login" className={buttonVariants({ className: "h-10 w-full" })}>
          {t("reset.login")}
        </Link>
      </div>
    );
  }
  if (token === null) return <MissingToken />;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <Field
        id="password"
        name="password"
        type="password"
        label={t("newPassword")}
        hint={t("passwordHint")}
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
      />
      <FormError error={state?.error} />
      {state?.error && LINK_ERRORS.includes(state.error.code) ? (
        <Link href="/forgot-password" className="text-primary text-center text-sm hover:underline">
          {t("reset.newLink")}
        </Link>
      ) : null}
      <SubmitButton>{t("reset.submit")}</SubmitButton>
    </form>
  );
}

function MissingToken() {
  const t = useTranslations("Auth.reset");
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">{t("noToken")}</p>
      <Link href="/forgot-password" className={buttonVariants({ className: "h-10 w-full" })}>
        {t("newLink")}
      </Link>
    </div>
  );
}
