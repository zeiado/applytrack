// Matching for the search box (components/command-palette.tsx): forgiving about case and
// Arabic spelling, so "اسكندرية" finds "إسكندرية" and "ة"/"ه" or "ى"/"ي" don't matter.

/** Lowercases and folds Arabic letter variants and diacritics, for comparing text. */
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ̀-ͯ]/g, "") // harakat, tatweel, Latin accents
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether every word of `query` appears somewhere in `fields`. An empty query matches all. */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalize(query).split(" ").filter(Boolean);
  const haystack = normalize(fields.filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}
