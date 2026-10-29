// Keyboard shortcuts in the signed-in app (wired up in components/command-palette.tsx).
// Single letters only count outside text fields, so typing an "n" in a form is just an "n".

/** Where a shortcut goes: "g" then a letter, like Gmail and Notion. */
export const GO_TO = { b: "/applications", f: "/follow-ups", s: "/stats", p: "/profile" } as const;

export type Shortcut =
  | { kind: "palette" }
  | { kind: "new" }
  | { kind: "help" }
  | { kind: "wait" } // the "g" of a "g then letter" pair
  | { kind: "go"; href: (typeof GO_TO)[keyof typeof GO_TO] };

/** Whether the keypress happened while typing somewhere (an input, a textarea, an editor). */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** What a keypress means. `previous` is the key pressed just before (for "g" pairs). */
export function shortcutFor(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">,
  previous: string | null,
): Shortcut | null {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "k") return { kind: "palette" };
  if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return null;
  if (previous === "g" && key in GO_TO) return { kind: "go", href: GO_TO[key as keyof typeof GO_TO] };
  if (key === "g") return { kind: "wait" };
  if (key === "/") return { kind: "palette" };
  if (key === "n") return { kind: "new" };
  if (event.key === "?") return { kind: "help" };
  return null;
}
