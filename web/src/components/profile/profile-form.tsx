"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";

import { NativeSelect } from "@/components/applications/native-select";
import { FormError } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/errors";
import { saveProfile } from "@/lib/profile/actions";
import { EXPERIENCE_LEVELS, MAX_LANGUAGES, MAX_LENGTH, MAX_SKILLS, type Profile } from "@/lib/profile/form";
import { cn } from "@/lib/utils";

import { ChipsInput } from "./chips-input";

type TextField = keyof typeof MAX_LENGTH;
type State = (ActionState & { savedAt?: number }) | undefined;

/**
 * Your profile in groups (about you, experience, skills and languages, who can see it). The
 * save bar sticks to the bottom of the screen once something has changed, and says so; after
 * saving it goes back to a quiet "Saved.".
 */
export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("Profile");
  const edits = useRef(0);
  const [changed, setChanged] = useState(0);
  const touch = () => setChanged((edits.current += 1));
  const [state, action, pending] = useActionState<State, FormData>(async (previous, form) => {
    const at = edits.current;
    const result = await saveProfile(previous, form);
    return result?.ok ? { ...result, savedAt: at } : result;
  }, undefined);
  const dirty = changed > (state?.savedAt ?? 0);

  const text = (name: TextField, wide = false) => (
    <div className={cn("grid gap-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={name}>{t(`fields.${name}.label`)}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={profile[name] ?? ""}
        maxLength={MAX_LENGTH[name]}
        placeholder={t(`fields.${name}.placeholder`)}
        autoComplete={name === "display_name" ? "name" : name === "city" ? "address-level2" : "off"}
      />
    </div>
  );

  return (
    <form action={action} onInput={touch} onChange={touch} className="grid gap-10">
      <Who profile={profile} />
      <Group title={t("groups.about")}>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("display_name")}
          {text("city")}
          {text("headline", true)}
        </div>
      </Group>

      <Group title={t("groups.experience")}>
        <div className="grid gap-5">
          <div className="grid gap-1.5">
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
          {text("education")}
        </div>
      </Group>

      <Group title={t("groups.skills")}>
        <div className="grid gap-5">
          {(["skills", "languages"] as const).map((name) => (
            <ChipsInput
              key={name}
              name={name}
              label={t(`fields.${name}.label`)}
              hint={t(`fields.${name}.hint`)}
              placeholder={t(`fields.${name}.placeholder`)}
              initial={profile[name] ?? []}
              max={name === "skills" ? MAX_SKILLS : MAX_LANGUAGES}
              onChange={touch}
            />
          ))}
        </div>
      </Group>

      <Group title={t("groups.visibility")}>
        <label className="bg-card flex cursor-pointer items-start gap-3 rounded-xl border p-4">
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
      </Group>

      <FormError error={state?.error} />
      {/* Quiet until something changes; then it sticks above the bottom edge and says so. */}
      <div
        className={cn(
          "sticky bottom-24 z-30 flex flex-wrap items-center gap-3 md:bottom-6",
          dirty && "bg-inverse-surface text-inverse-surface-foreground w-fit rounded-full py-2 ps-5 pe-2 shadow-lg",
        )}
      >
        {dirty && <span className="text-sm">{t("unsaved")}</span>}
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {state?.ok && !dirty && (
          <span role="status" className="text-muted-foreground text-sm">
            {t("saved")}
          </span>
        )}
      </div>
    </form>
  );
}

/** The top of the profile: your initials, name and headline, as others would see them. */
function Who({ profile }: { profile: Profile }) {
  const t = useTranslations("Profile");
  const name = profile.display_name?.trim();
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase();
  return (
    <div className="bg-surface-container-low flex items-center gap-4 rounded-2xl p-5">
      <span
        aria-hidden
        className="bg-primary-container text-primary-container-foreground flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold"
      >
        {initials || "?"}
      </span>
      <div className="grid min-w-0 gap-0.5">
        <span className={cn("truncate text-lg font-semibold", !name && "text-muted-foreground")}>{name || t("noName")}</span>
        {profile.headline && <span className="text-muted-foreground truncate">{profile.headline}</span>}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
