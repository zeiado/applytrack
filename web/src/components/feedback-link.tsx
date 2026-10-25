import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import { FEEDBACK_URL } from "@/config/brand";

/** "Feedback" in the app header: an icon on phones, with its word from `md` up. */
export function FeedbackLink() {
  const t = useTranslations("Nav");
  if (!FEEDBACK_URL) return null;
  return (
    <a
      href={FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center gap-1.5 text-sm font-medium md:size-auto"
    >
      <MessageSquare aria-hidden className="size-4" />
      <span className="sr-only md:not-sr-only">{t("feedback")}</span>
    </a>
  );
}
