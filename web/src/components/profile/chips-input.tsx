"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

/** Splits on commas, the Arabic comma too (،). */
const SEPARATOR = /[,،]/;

/** Adds `next` to `list` unless it's empty or already there (ignoring case). */
export function addChip(list: string[], next: string, max: number): string[] {
  const value = next.trim();
  if (!value || list.length >= max) return list;
  if (list.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return list;
  return [...list, value];
}

/**
 * A list you build one item at a time, as chips: type and press Enter or a comma to add one,
 * × or Backspace (on an empty field) to remove it. The form receives them comma-joined in
 * `name`, the same as a plain text field, so the server action doesn't change.
 */
export function ChipsInput({
  name,
  label,
  hint,
  placeholder,
  initial,
  max,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  initial: string[];
  max: number;
  onChange?: () => void;
}) {
  const t = useTranslations("Profile.chips");
  const id = useId();
  const [chips, setChips] = useState(initial);
  const [text, setText] = useState("");

  const update = (next: string[], rest = "") => {
    setChips(next);
    setText(rest);
    onChange?.();
  };

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="border-input focus-within:border-primary flex min-h-12 flex-wrap items-center gap-1.5 rounded-xs border px-2 py-1.5 focus-within:shadow-[inset_0_0_0_1px_var(--primary)]">
        {chips.length > 0 && (
          // No name of its own: "Skills" already names the field, and each chip's "Remove …"
          // button says what it is.
          <ul className="contents">
            {chips.map((chip) => (
              <li
                key={chip}
                className="chip bg-secondary text-secondary-foreground flex h-8 items-center gap-1 rounded-sm ps-3 pe-1 text-sm"
              >
                <span dir="auto">{chip}</span>
                <button
                  type="button"
                  aria-label={t("remove", { item: chip })}
                  onClick={() => update(chips.filter((item) => item !== chip), text)}
                  className="state-layer relative flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={id}
          value={text}
          placeholder={chips.length === 0 ? placeholder : t("more")}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const parts = event.target.value.split(SEPARATOR);
            if (parts.length === 1) {
              setText(event.target.value);
              onChange?.();
              return;
            }
            // Everything before the last comma becomes chips; what's after it stays typed.
            const rest = parts.pop() ?? "";
            update(parts.reduce((list, part) => addChip(list, part, max), chips), rest);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && text.trim()) {
              event.preventDefault();
              update(addChip(chips, text, max));
            } else if (event.key === "Backspace" && text === "" && chips.length > 0) {
              update(chips.slice(0, -1));
            }
          }}
          className="h-8 min-w-32 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground"
        />
      </div>
      {/* What the form sends: the chips, plus anything still being typed. */}
      <input type="hidden" name={name} value={addChip(chips, text, max).join(", ")} />
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {hint}
      </p>
    </div>
  );
}
