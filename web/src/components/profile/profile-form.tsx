"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormError } from "@/components/auth/form-parts";
import { NativeSelect } from "@/components/applications/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile } from "@/lib/profile/actions";
import { EXPERIENCE_LEVELS, MAX_LENGTH, type Profile, TEXT_FIELDS } from "@/lib/profile/form";

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("Profile");
  const [state, action, pending] = useActionState(saveProfile, undefined);

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {TEXT_FIELDS.map((name) => (
          <div key={name} className={name === "headline" || name === "education" ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"}>
            <Label htmlFor={name}>{t(`fields.${name}.label`)}</Label>
            <Input
              id={name}
              name={name}
              defaultValue={profile[name] ?? ""}
              maxLength={MAX_LENGTH[name]}
              placeholder={t(`fields.${name}.placeholder`)}
              className="h-10"
              autoComplete={name === "display_name" ? "name" : name === "city" ? "address-level2" : "off"}
            />
          </div>
        ))}
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="experience_level">{t("fields.experience_level.label")}</Label>
          <NativeSelect id="experience_level" name="experience_level" defaultValue={profile.experience_level ?? ""}>
            <option value="">{t("fields.experience_level.none")}</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`levels.${level}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        {(["skills", "languages"] as const).map((name) => (
          <div key={name} className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={name}>{t(`fields.${name}.label`)}</Label>
            <Input
              id={name}
              name={name}
              defaultValue={(profile[name] ?? []).join(", ")}
              placeholder={t(`fields.${name}.placeholder`)}
              aria-describedby={`${name}-hint`}
              className="h-10"
            />
            <p id={`${name}-hint`} className="text-muted-foreground text-xs">
              {t(`fields.${name}.hint`)}
            </p>
          </div>
        ))}
      </div>

      <label className="bg-card flex items-start gap-3 rounded-xl border p-4">
        <input
          type="checkbox"
          name="open_to_recruiters"
          defaultChecked={profile.visibility === "recruiters"}
          className="accent-primary mt-1 size-4"
          aria-describedby="recruiters-hint"
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{t("recruiters.label")}</span>
          <span id="recruiters-hint" className="text-muted-foreground text-xs">
            {t("recruiters.hint")}
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
