import type messages from "../messages/en.json";
import type { routing } from "./i18n/routing";

// Type-checks message keys and locales everywhere next-intl is used.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
