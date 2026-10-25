import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
      <Link href="/" className="shrink-0">
        <Logo />
      </Link>
      <div className="flex items-center gap-4">
        {children}
        <ThemeToggle />
        {/* It links to the current page, whose path may only be known per request. */}
        <Suspense>
          <LanguageSwitcher />
        </Suspense>
      </div>
    </header>
  );
}
