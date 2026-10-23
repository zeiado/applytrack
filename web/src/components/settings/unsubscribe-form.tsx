"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormError, FormSuccess, SubmitButton } from "@/components/auth/form-parts";
import { useLinkToken } from "@/components/auth/use-link-token";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { unsubscribeFromReminders } from "@/lib/account/actions";

/** A button, not an automatic unsubscribe: link scanners open every link in an email,
 * and opening this page alone must change nothing. */
export function UnsubscribeForm() {
  const t = useTranslations("Unsubscribe");
  const token = useLinkToken();
  const [state, action] = useActionState(unsubscribeFromReminders, undefined);

  if (token === undefined) return null;
  if (token === null) return <p className="text-muted-foreground text-sm">{t("noToken")}</p>;
  if (state?.ok) {
    return (
      <div className="grid gap-4">
        <FormSuccess>{t("done")}</FormSuccess>
        <Link href="/settings" className={buttonVariants({ variant: "outline", className: "h-12 w-full rounded-2xl" })}>
          {t("settings")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormError error={state?.error} />
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
