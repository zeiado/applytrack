"use client";

import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";

import { NativeSelect } from "@/components/applications/native-select";
import { FormError, FormSuccess } from "@/components/auth/form-parts";
import { GoogleIdentityButton, googleSignInAvailable } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteAccountWithGoogle,
  deleteAccountWithPassword,
  sendSetPasswordEmail,
  updatePreferences,
} from "@/lib/account/actions";
import type { UserRead } from "@/lib/api/client";

type Zone = { value: string; label: string };

export function PreferencesForm({
  user,
  suggested,
  zones,
}: {
  user: UserRead;
  suggested: Zone[];
  zones: Zone[];
}) {
  const t = useTranslations("Settings.preferences");
  const tLanguage = useTranslations("LanguageSwitcher");
  const [state, action, pending] = useActionState(updatePreferences, undefined);
  const zoneSelect = useRef<HTMLSelectElement>(null);
  const known = new Set(zones.map((zone) => zone.value));

  function detect() {
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zoneSelect.current && known.has(deviceZone)) zoneSelect.current.value = deviceZone;
  }

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="locale">{t("language")}</Label>
        <NativeSelect id="locale" name="locale" defaultValue={user.locale} aria-describedby="locale-hint">
          <option value="ar">{tLanguage("ar")}</option>
          <option value="en">{tLanguage("en")}</option>
        </NativeSelect>
        <p id="locale-hint" className="text-muted-foreground text-xs">
          {t("languageHint")}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="timezone">{t("timezone")}</Label>
        <NativeSelect
          ref={zoneSelect}
          id="timezone"
          name="timezone"
          defaultValue={user.timezone}
          aria-describedby="timezone-hint"
        >
          <optgroup label={t("suggested")}>
            {suggested.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("all")}>
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </optgroup>
        </NativeSelect>
        <p id="timezone-hint" className="text-muted-foreground text-xs">
          {t("timezoneHint")}
        </p>
        <Button type="button" variant="link" className="h-auto w-fit gap-1 p-0" onClick={detect}>
          <LocateFixed aria-hidden />
          {t("detect")}
        </Button>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="reminder_emails"
          defaultChecked={user.reminder_emails}
          className="accent-primary mt-1 size-4"
          aria-describedby="reminders-hint"
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{t("reminders")}</span>
          <span id="reminders-hint" className="text-muted-foreground text-xs">
            {t("remindersHint")}
          </span>
        </span>
      </label>
      <FormError error={state?.error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-10 px-5" disabled={pending}>
          {t("save")}
        </Button>
        {state?.ok && (
          <span role="status" className="text-muted-foreground text-sm">
            {t("saved")}
          </span>
        )}
      </div>
    </form>
  );
}

/** For accounts made with Google: a password is set through the reset email. */
export function SetPassword() {
  const t = useTranslations("Settings.password");
  const [state, action, pending] = useActionState(sendSetPasswordEmail, undefined);

  if (state?.ok) return <FormSuccess>{t("sent")}</FormSuccess>;
  return (
    <form action={action} className="grid gap-3">
      <p className="text-muted-foreground text-sm">{t("googleOnly")}</p>
      <FormError error={state?.error} />
      <Button type="submit" variant="outline" className="h-10 w-fit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}

/** Deleting asks again: with the password, or (accounts without one) a Google sign-in. */
export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("Settings.delete");
  const tAuth = useTranslations("Auth");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccountWithPassword, undefined);

  if (!open) {
    return (
      <Button variant="destructive" className="h-10 w-fit" onClick={() => setOpen(true)}>
        {t("start")}
      </Button>
    );
  }
  return (
    <div className="border-destructive/30 grid gap-4 rounded-lg border p-4" role="group" aria-label={t("title")}>
      {hasPassword ? (
        <form action={action} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="delete-password">{t("passwordLabel")}</Label>
            <Input
              id="delete-password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              autoFocus
              className="h-10"
            />
          </div>
          <FormError error={state?.error} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="destructive" className="h-10" disabled={pending}>
              {pending ? tAuth("working") : t("confirm")}
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm">{t("googleConfirm")}</p>
          {googleSignInAvailable() && (
            <GoogleIdentityButton onCredential={deleteAccountWithGoogle} text="continue_with" />
          )}
          <Button type="button" variant="ghost" className="h-10 w-fit" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
