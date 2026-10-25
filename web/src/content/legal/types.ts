import type { Locale } from "@/i18n/routing";

/** A paragraph, or a bulleted list. */
export type Block = string | { list: string[] };

export type LegalSection = { id: string; title: string; body: Block[] };

export type LegalDoc = {
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
};

/** The same document in every language, with the date it last changed. */
export type LegalText = { updated: string } & Record<Locale, LegalDoc>;
