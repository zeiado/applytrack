"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionError } from "@/lib/auth/errors";

export function Field({
  label,
  hint,
  id,
  ...input
}: { label: string; hint?: string; id: string } & ComponentProps<"input">) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-10"
        // Emails and passwords are Latin text; left to right keeps them readable
        // in Arabic too.
        dir={input.type === "email" || input.type === "password" ? "ltr" : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Disabled with "Please wait…" while its form is being sent. */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Auth");
  return (
    <Button type="submit" className="h-10 w-full text-base" disabled={pending} aria-busy={pending}>
      {pending ? t("working") : children}
    </Button>
  );
}

export function FormError({ error }: { error?: ActionError }) {
  const t = useTranslations("Errors");
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{t(error.code, { seconds: error.retryAfter ?? 60 })}</AlertDescription>
    </Alert>
  );
}

export function FormSuccess({ children }: { children: React.ReactNode }) {
  return (
    <Alert role="status">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** "or" between the Google button and the email form. */
export function OrDivider() {
  const t = useTranslations("Auth");
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" />
      {t("or")}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
