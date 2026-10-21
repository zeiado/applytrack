"use client";

import { MailWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resendVerificationEmail } from "@/lib/auth/actions";
import { isolate } from "@/lib/bidi";

import { FormError } from "./form-parts";

/** Shown until the user opens the link in the verification email. */
export function VerifyBanner({ email }: { email: string }) {
  const t = useTranslations("Dashboard");
  const [state, action, pending] = useActionState(resendVerificationEmail, undefined);

  return (
    <Alert>
      <MailWarning aria-hidden />
      <AlertDescription className="grid gap-2">
        <p className="wrap-anywhere">{t("verifyBanner", { email: isolate(email) })}</p>
        {state?.ok ? (
          <p role="status">{t("resent")}</p>
        ) : (
          <form action={action}>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {t("resend")}
            </Button>
          </form>
        )}
        <FormError error={state?.error} />
      </AlertDescription>
    </Alert>
  );
}
