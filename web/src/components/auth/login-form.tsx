"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";
import { logIn } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/errors";

import { Field, FormError, SubmitButton } from "./form-parts";
import { GoogleButton } from "./google-button";

export function LoginForm() {
  const t = useTranslations("Auth");
  const next = safeNextPath(useSearchParams().get("next"));
  const [state, action] = useActionState(logIn, undefined);

  return (
    <div className="grid gap-4">
      <GoogleButton next={next} />
      <form action={action} className="grid gap-4">
        {next && <input type="hidden" name="next" value={next} />}
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
          autoComplete="current-password"
          required
        />
        <FormError error={state?.error} />
        <SubmitButton>{t("login.submit")}</SubmitButton>
      </form>
      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          {t("login.forgot")}
        </Link>
        <p className="text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="text-primary hover:underline">
            {t("login.register")}
          </Link>
        </p>
      </div>
    </div>
  );
}
