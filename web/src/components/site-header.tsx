import { LanguageSwitcher } from "@/components/language-switcher";
import { APP_NAME } from "@/config/brand";
import { Link } from "@/i18n/navigation";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
      <Link href="/" className="text-lg font-bold">
        {APP_NAME}
      </Link>
      <div className="flex items-center gap-4">
        {children}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
