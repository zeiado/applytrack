"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { verifyEmail } from "@/lib/auth/actions";
import type { ActionState } from "@/lib/auth/errors";

import { FormError, FormSuccess } from "./form-parts";
import { useLinkToken } from "./use-link-token";

// One request per token, even if the effect runs twice (React Strict Mode): the
// second use of a one-time link would fail.
const requests = new Map<string, Promise<ActionState>>();

function verifyOnce(token: string): Promise<ActionState> {
  let request = requests.get(token);
  if (!request) {
    request = verifyEmail(token);
    requests.set(token, request);
  }
  return request;
}

/** Confirms the email as soon as the page opens with the link's token. */
export function VerifyEmail() {
  const t = useTranslations("Auth.verify");
  const token = useLinkToken();
  const [result, setResult] = useState<ActionState>();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyOnce(token).then((outcome) => {
      if (!cancelled) setResult(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (token === undefined) return null;
  if (token === null) return <p className="text-muted-foreground text-sm">{t("noToken")}</p>;
  if (!result) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        {t("checking")}
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      {result.ok ? <FormSuccess>{t("done")}</FormSuccess> : <FormError error={result.error} />}
      <Link href="/dashboard" className={buttonVariants({ className: "h-10 w-full" })}>
        {t("continue")}
      </Link>
    </div>
  );
}
