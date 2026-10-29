"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SITE_LINKS } from "@/components/site/links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** The public site's header: the pages, Log in and Start free, the theme and the language.
 * It sits on the page until you scroll, then takes the M3 "scrolled" container colour.
 * Phones get the pages in a sheet behind a menu button. `current` is the path, or null
 * while it isn't known yet. */
export function SiteNavBar({ current }: { current: string | null }) {
  const t = useTranslations("Site.nav");
  const tHome = useTranslations("Home");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const links = (kind: "bar" | "sheet") =>
    SITE_LINKS.map(({ href, key }) => {
      const active = current === href || current?.startsWith(`${href}/`);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(
            "state-layer relative flex items-center rounded-full font-medium focus-visible:outline-2 focus-visible:outline-ring",
            kind === "bar" ? "h-10 px-4 text-sm" : "h-12 px-5 text-base",
            active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(key)}
        </Link>
      );
    });

  return (
    <header
      data-scrolled={scrolled}
      className="bg-background/80 data-[scrolled=true]:bg-surface-container/95 sticky top-0 z-40 backdrop-blur-md motion-safe:transition-[background-color,box-shadow] data-[scrolled=true]:shadow-[0_1px_0_var(--border)]"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4">
        <Link href="/" className="me-4 shrink-0">
          <Logo />
        </Link>
        <nav aria-label={t("main")} className="hidden items-center gap-1 md:flex">
          {links("bar")}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
            <ThemeToggle />
            {/* It links to the current page, whose path may only be known per request. */}
            <Suspense>
              <LanguageSwitcher />
            </Suspense>
            <Link href="/login" className={buttonVariants({ variant: "text", className: "ms-2" })}>
              {tHome("logIn")}
            </Link>
          </div>
          <Link href="/register" className={buttonVariants({ size: "sm", className: "md:h-10 md:px-6 md:text-sm" })}>
            {tHome("getStarted")}
          </Link>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label={t("menu")} />}>
              <Menu aria-hidden />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:hidden" />
              <Dialog.Popup className="bg-surface-container fixed inset-x-0 top-0 z-50 grid gap-4 rounded-b-2xl px-4 pt-3 pb-6 shadow-lg outline-none transition-transform data-[ending-style]:-translate-y-4 data-[starting-style]:-translate-y-4 md:hidden">
                <div className="flex h-10 items-center justify-between">
                  <Dialog.Title className="sr-only">{t("main")}</Dialog.Title>
                  <Logo />
                  <Dialog.Close render={<Button variant="ghost" size="icon" aria-label={t("close")} />}>
                    <X aria-hidden />
                  </Dialog.Close>
                </div>
                <nav aria-label={t("main")} className="grid gap-1">
                  {links("sheet")}
                </nav>
                <div className="grid gap-3 border-t pt-4">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
                  >
                    {tHome("logIn")}
                  </Link>
                  <div className="flex items-center justify-between px-1">
                    <Suspense>
                      <LanguageSwitcher />
                    </Suspense>
                    <ThemeToggle />
                  </div>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}

/** The header with the current page marked. Reads the path, so render it inside <Suspense>. */
export function SiteNav() {
  return <SiteNavBar current={usePathname()} />;
}
