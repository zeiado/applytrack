"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { updateField } from "@/lib/applications/actions";
import type { InlineField as Field } from "@/lib/applications/inline";
import { cn } from "@/lib/utils";

type Kind = "text" | "url" | "date" | "select" | "textarea" | "salary";

/**
 * One property you can edit in place, Notion style: it reads as text; click it (or press
 * Enter on it) to get a field; Enter or clicking away saves, Esc cancels. The new value
 * shows straight away and goes back, with a message, if saving fails.
 *
 * `values` is what's stored now: `{ value }`, or `{ min, max }` for the salary.
 * `display` is how it reads (formatted), or empty for "add …".
 */
export function InlineField({
  applicationId,
  field,
  label,
  kind,
  values,
  display,
  options,
  title = false,
}: {
  applicationId: string;
  field: Field;
  label: string;
  kind: Kind;
  values: Record<string, string>;
  display: string;
  options?: { value: string; label: string }[];
  /** The company or role at the top of the page: bigger, no box. */
  title?: boolean;
}) {
  const t = useTranslations("Inline");
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [shown, setShown] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) first.current?.focus();
  }, [editing]);

  const open = () => {
    setDraft(values);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  const save = (next = draft) => {
    setEditing(false);
    const unchanged = Object.keys(next).every((key) => (next[key] ?? "").trim() === (values[key] ?? "").trim());
    if (unchanged) return;
    setShown(preview(kind, next, options));
    startTransition(async () => {
      const result = await updateField(applicationId, field, next);
      setShown(null);
      if (result && "error" in result && result.error) {
        toast.add({ title: result.error.code === "validation_error" ? t("invalid", { field: label }) : t("failed") });
      }
    });
  };

  const text = shown ?? display;
  const box = "border-input w-full rounded-xs border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-primary";
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === "Enter" && (kind !== "textarea" || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  if (editing) {
    if (kind === "salary") {
      return (
        <div
          className="flex items-center gap-2"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) save();
          }}
        >
          <input
            ref={first}
            aria-label={t("from")}
            inputMode="numeric"
            dir="ltr"
            value={draft.min ?? ""}
            onChange={(event) => setDraft({ ...draft, min: event.target.value })}
            onKeyDown={keys}
            className={box}
          />
          <span aria-hidden>–</span>
          <input
            aria-label={t("to")}
            inputMode="numeric"
            dir="ltr"
            value={draft.max ?? ""}
            onChange={(event) => setDraft({ ...draft, max: event.target.value })}
            onKeyDown={keys}
            className={box}
          />
        </div>
      );
    }
    if (kind === "select") {
      return (
        <select
          ref={first}
          aria-label={label}
          value={draft.value ?? ""}
          onChange={(event) => save({ value: event.target.value })}
          onBlur={cancel}
          onKeyDown={keys}
          className={box}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    const common = {
      "aria-label": label,
      value: draft.value ?? "",
      onKeyDown: keys,
      onBlur: () => save(),
      dir: kind === "url" ? "ltr" : "auto",
    } as const;
    return kind === "textarea" ? (
      <textarea
        ref={first}
        {...common}
        rows={4}
        onChange={(event) => setDraft({ value: event.target.value })}
        className={cn(box, "resize-y leading-relaxed")}
      />
    ) : (
      <input
        ref={first}
        {...common}
        type={kind === "date" ? "date" : kind === "url" ? "url" : "text"}
        onChange={(event) => setDraft({ value: event.target.value })}
        className={cn(box, title && "text-2xl font-bold")}
      />
    );
  }

  return (
    <button
      ref={button}
      type="button"
      onClick={open}
      // The value itself is the button's name (so the company still reads as the company);
      // the label sits next to it, and the tooltip says what a click does.
      title={t("edit", { field: label })}
      aria-busy={pending}
      className={cn(
        "group/inline state-layer relative -mx-2 flex w-[calc(100%+1rem)] min-w-0 items-start gap-2 rounded-md px-2 py-1 text-start focus-visible:outline-2 focus-visible:outline-ring",
        pending && "opacity-60",
      )}
    >
      <span
        dir="auto"
        className={cn(
          "min-w-0 flex-1 wrap-anywhere",
          kind === "textarea" && "whitespace-pre-line",
          !text && "text-muted-foreground",
          title ? "text-2xl font-bold" : "text-sm",
        )}
      >
        {text || t("empty")}
      </span>
      <Pencil
        aria-hidden
        className="text-muted-foreground mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100"
      />
    </button>
  );
}

/** What the value reads as while it saves (the page refreshes with the stored one). */
function preview(kind: Kind, values: Record<string, string>, options?: { value: string; label: string }[]): string {
  if (kind === "select") return options?.find((option) => option.value === values.value)?.label ?? "";
  if (kind === "salary") return [values.min, values.max].filter(Boolean).join(" – ");
  return values.value ?? "";
}
