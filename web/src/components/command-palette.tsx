"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BarChart3, BellRing, CornerDownLeft, KanbanSquare, List, Moon, Plus, Search, Settings, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

import { CompanyInitial } from "@/components/applications/company-initial";
import { StatusDot } from "@/components/applications/status-badge";
import { useRouter } from "@/i18n/navigation";
import { type SearchEntry, searchIndex } from "@/lib/applications/search-index";
import { matches } from "@/lib/search";
import { shortcutFor } from "@/lib/shortcuts";
import { saveTheme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  group: "applications" | "goTo" | "actions";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

const PaletteContext = createContext<{ open: (help?: boolean) => void }>({ open: () => {} });

/** Opens the search box: `const { open } = usePalette(); open()`. */
export function usePalette() {
  return useContext(PaletteContext);
}

/**
 * The signed-in app's search box (Ctrl/⌘K or "/"): your applications by company or role,
 * the pages, and a few actions. Also listens for the other shortcuts (lib/shortcuts.ts):
 * N for a new application, G then B/F/S/P to go to a page, ? to list them all.
 */
export function CommandPalette({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const router = useRouter();
  const previous = useRef<string | null>(null);

  const open = useCallback((withHelp = false) => {
    setHelp(withHelp);
    setOpen(true);
  }, []);

  useEffect(() => {
    let reset: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      const shortcut = shortcutFor(event, previous.current);
      previous.current = shortcut?.kind === "wait" ? "g" : null;
      clearTimeout(reset);
      if (shortcut?.kind === "wait") reset = setTimeout(() => (previous.current = null), 1200);
      if (!shortcut || shortcut.kind === "wait") return;
      event.preventDefault();
      if (shortcut.kind === "palette") setOpen((now) => !now);
      else if (shortcut.kind === "help") open(true);
      else if (shortcut.kind === "new") router.push("/applications/new");
      else router.push(shortcut.href);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(reset);
    };
  }, [open, router]);

  const value = useMemo(() => ({ open }), [open]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      <Dialog.Root open={isOpen} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="sheet-backdrop fixed inset-0 z-50 bg-black/30" />
          <Dialog.Popup className="palette bg-popover text-popover-foreground fixed inset-x-3 top-[12vh] z-50 mx-auto max-w-xl overflow-hidden rounded-2xl shadow-2xl outline-none">
            {isOpen && <PaletteBody help={help} close={() => setOpen(false)} />}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </PaletteContext.Provider>
  );
}

function PaletteBody({ help, close }: { help: boolean; close: () => void }) {
  const t = useTranslations("Palette");
  const tNav = useTranslations("Nav");
  const tStatus = useTranslations("Status");
  const locale = useLocale();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    searchIndex()
      .then((items) => live && setEntries(items))
      .catch(() => live && setEntries([]));
    return () => {
      live = false;
    };
  }, []);

  const go = useCallback(
    (href: string) => () => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const commands = useMemo<Command[]>(() => {
    const icon = "size-[1.125rem]";
    const pages: Command[] = [
      { id: "board", group: "goTo", label: tNav("applications"), hint: "G B", icon: <KanbanSquare className={icon} />, run: go("/applications") },
      { id: "list", group: "goTo", label: t("list"), icon: <List className={icon} />, run: go("/applications?view=list") },
      { id: "follow-ups", group: "goTo", label: tNav("followUps"), hint: "G F", icon: <BellRing className={icon} />, run: go("/follow-ups") },
      { id: "stats", group: "goTo", label: tNav("stats"), hint: "G S", icon: <BarChart3 className={icon} />, run: go("/stats") },
      { id: "profile", group: "goTo", label: tNav("profile"), hint: "G P", icon: <UserRound className={icon} />, run: go("/profile") },
      { id: "settings", group: "goTo", label: tNav("settings"), icon: <Settings className={icon} />, run: go("/settings") },
    ];
    const actions: Command[] = [
      { id: "new", group: "actions", label: t("newApplication"), hint: "N", icon: <Plus className={icon} />, run: go("/applications/new") },
      {
        id: "theme",
        group: "actions",
        label: t("toggleTheme"),
        icon: <Moon className={icon} />,
        run: () => {
          saveTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
          close();
        },
      },
    ];
    const apps: Command[] = (entries ?? [])
      .filter((entry) => query.trim() && matches(query, entry.company, entry.role_title))
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        group: "applications",
        label: entry.company,
        hint: entry.role_title,
        icon: <CompanyInitial company={entry.company} locale={locale} className="size-7 text-xs" />,
        run: go(`/applications/${entry.id}`),
      }));
    const rest = [...pages, ...actions].filter((command) => matches(query, command.label));
    return [...apps, ...rest];
  }, [entries, query, go, t, tNav, locale, close]);

  const showHelp = help || query.trim() === "?";
  // Keep the highlight on a real row as the list changes.
  const current = Math.min(active, Math.max(commands.length - 1, 0));
  const groups = (["applications", "goTo", "actions"] as const)
    .map((group) => ({ group, items: commands.filter((command) => command.group === group) }))
    .filter(({ items }) => items.length > 0);

  return (
    <div className="grid">
      <Dialog.Title className="sr-only">{t("title")}</Dialog.Title>
      <div className="flex items-center gap-3 border-b px-4">
        <Search aria-hidden className="text-muted-foreground size-5 shrink-0" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={commands[current] ? `${listId}-${commands[current].id}` : undefined}
          aria-label={t("title")}
          placeholder={t("placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current + 1) % Math.max(commands.length, 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current - 1 + commands.length) % Math.max(commands.length, 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              commands[current]?.run();
            }
          }}
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div id={listId} role="listbox" aria-label={t("title")} className="max-h-[50vh] overflow-y-auto p-2">
        {query.trim() && entries === null && <p className="text-muted-foreground px-3 py-2 text-sm">{t("loading")}</p>}
        {commands.length === 0 && !showHelp && (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">{t("empty")}</p>
        )}
        {groups.map(({ group, items }) => (
          <div key={group} role="group" aria-label={t(`groups.${group}`)} className="grid pb-1">
            <span className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-medium">{t(`groups.${group}`)}</span>
            {items.map((command) => {
              const index = commands.indexOf(command);
              const entry = group === "applications" ? entries?.find((item) => item.id === command.id) : undefined;
              return (
                <div
                  key={command.id}
                  id={`${listId}-${command.id}`}
                  role="option"
                  aria-selected={index === current}
                  onMouseMove={() => setActive(index)}
                  onClick={command.run}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm",
                    index === current && "bg-foreground/8",
                  )}
                >
                  <span aria-hidden className="text-muted-foreground flex shrink-0 items-center">
                    {command.icon}
                  </span>
                  <span className="truncate font-medium">{command.label}</span>
                  {entry ? (
                    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 truncate">
                      {command.hint}
                      <StatusDot status={entry.status} className="ms-1" />
                      <span className="sr-only">{tStatus(entry.status)}</span>
                    </span>
                  ) : (
                    command.hint && (
                      <kbd className="text-muted-foreground ms-auto rounded border px-1.5 font-sans text-xs">{command.hint}</kbd>
                    )
                  )}
                  {index === current && <CornerDownLeft aria-hidden className="text-muted-foreground ms-auto size-4 shrink-0" />}
                </div>
              );
            })}
          </div>
        ))}
        {showHelp && <ShortcutList />}
      </div>
    </div>
  );
}

function ShortcutList() {
  const t = useTranslations("Palette.shortcuts");
  const rows = [
    ["Ctrl K", t("search")],
    ["N", t("new")],
    ["G B", t("board")],
    ["G F", t("followUps")],
    ["G S", t("stats")],
    ["G P", t("profile")],
    ["Esc", t("close")],
  ] as const;
  return (
    <section aria-label={t("title")} className="border-t px-3 py-3">
      <h2 className="text-muted-foreground pb-2 text-xs font-medium">{t("title")}</h2>
      <dl className="grid gap-1.5 text-sm">
        {rows.map(([keys, label]) => (
          <div key={keys} className="flex items-center justify-between gap-4">
            <dt>{label}</dt>
            <dd>
              <kbd className="rounded border px-1.5 font-sans text-xs" dir="ltr">
                {keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The search button in the sidebar and the phone header. */
export function SearchButton({ variant }: { variant: "sidebar" | "icon" }) {
  const t = useTranslations("Palette");
  const { open } = usePalette();
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => open()}
        aria-label={t("title")}
        className="state-layer text-muted-foreground relative flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Search aria-hidden className="size-[1.125rem]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => open()}
      title={t("title")}
      className="state-layer text-muted-foreground hover:text-foreground relative flex h-10 items-center gap-3 rounded-full px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring collapsed:justify-center collapsed:px-0"
    >
      <Search aria-hidden className="size-[1.125rem] shrink-0" />
      <span className="truncate collapsed:sr-only">{t("title")}</span>
      <kbd aria-hidden className="ms-auto rounded border px-1.5 font-sans text-xs collapsed:hidden" dir="ltr">
        Ctrl K
      </kbd>
    </button>
  );
}
