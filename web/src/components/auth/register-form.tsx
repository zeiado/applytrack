"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";
import { register } from "@/lib/auth/actions";

import { Field, FormError, SubmitButton } from "./form-parts";
import { GoogleButton } from "./google-button";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const tLegal = useTranslations("Legal");
  const [state, action] = useActionState(register, undefined);

  return (
    <div className="grid gap-4">
      <GoogleButton next={null} />
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
        <Field
          id="password"
          name="password"
          type="password"
          label={t("password")}
          hint={t("passwordHint")}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        <FormError error={state?.error} />
        <SubmitButton>{t("register.submit")}</SubmitButton>
      </form>
      <p className="text-muted-foreground text-center text-sm">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("register.login")}
        </Link>
      </p>
      {/* Covers both ways in: the Google button and the form. */}
      <p className="text-muted-foreground text-center text-xs leading-5">
        {tLegal.rich("agree", {
          terms: (chunks) => (
            <Link href="/terms" className="hover:text-foreground underline">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="hover:text-foreground underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
