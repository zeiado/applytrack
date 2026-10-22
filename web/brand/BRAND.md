# Sekka brand

How Sekka looks. Follow this for any UI work in `web/`. All paths below are relative to `web/`.

For the full redesign of the app's screens, follow `brand/REDESIGN.md` step by step. It builds on this file.

## What's in `brand/`

| File | Use |
|---|---|
| `tokens.css` | Drop-in `:root` and `.dark` blocks for `src/app/globals.css` (shadcn variable names, OKLCH, hex in comments) |
| `tokens.json` | The core palette with hex, OKLCH and measured contrast ratios |
| `icons/` | Final app icons and favicons, named for where they go (see below) |
| `logo/` | Outlined SVG lockups in `color`, `mono` and `reversed` |

## Applying the brand (one-time)

1. **Colours.** In `src/app/globals.css`, replace the whole `:root { ... }` and `.dark { ... }` blocks with the two blocks from `brand/tokens.css`. In the `@theme inline` block add:
   ```css
   --color-yes: var(--yes);
   --color-yes-foreground: var(--yes-foreground);
   ```
   This makes `bg-yes text-yes-foreground` available. Leave the rest of `globals.css` as it is.
2. **Icons.** Copy over the existing placeholders:
   - `brand/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `icon.svg` → `public/icons/`
   - `brand/icons/favicon.ico` → `src/app/favicon.ico`
   - `brand/icons/favicon.svg` → `src/app/icon.svg` (the bare symbol, switches teal in dark mode)
   - `brand/icons/apple-icon.png` → `src/app/apple-icon.png` (180×180, full bleed)
3. **Manifest.** In `src/app/manifest.ts` set `background_color: "#FAF8F4"`. `theme_color` stays `#00695a`. Icon paths don't change.
4. **Font.** Already done: `app/[locale]/layout.tsx` loads IBM Plex Sans Arabic as `--font-sans`. Keep it.
   **Icon script.** `scripts/icons.mjs` (`npm run icons`) still draws the old placeholder icons. Change it to copy from `brand/icons/` before anyone runs it, or it will overwrite the new ones.
5. **Logo in the UI.** Wherever the app name is shown as a logo (header, auth pages, empty states), use the SVG lockup for the active locale: `sekka-horizontal-arabic-*.svg` for Arabic, `sekka-horizontal-latin-*.svg` for English. Copy the ones you need into `public/brand/`. Keep `APP_NAME` in `src/config/brand` for text and metadata.
6. Run lint, type-check and the unit tests, then check light mode, dark mode and RTL in the browser.

## Rules

- **Never type the name as the logo.** "sekka" and "سكة" are drawn lettering. Use the SVGs, never text in a font.
- **Logo by language.** Use Arabic lockups on `dir="rtl"` pages and Latin lockups on English pages. `stacked` is only for places that show both languages at once, `symbol` for small spots (collapsed sidebar, loading, avatar).
- **Never mirror the symbol for RTL.** Don't rotate, stretch, recolour it, or add shadows either.
- **Clear space:** 2× the amber dot's diameter on every side. **Minimum size:** symbol 16 px, horizontal lockup 96 px wide, stacked 64 px wide.
- **Amber (`yes`) is for good news only:** an offer received, an application accepted. Use `bg-yes text-yes-foreground`. Never use it as text colour, for warnings or errors, or for routine buttons.
- **`accent` is not the brand amber.** In shadcn it's the hover and selected background for menus and lists, so it stays a quiet teal-grey.
- **Primary (teal)** is the single main action per screen ("Add application", "Start free").
- **Contrast:** every pair in `tokens.css` passes WCAG AA (lowest 5.26:1). Don't invent new colours. If you need one, derive it in OKLCH from these and check it reaches 4.5:1 for text.
- **Illustrations:** simple line drawings from the road motif (a thick teal stroke with round ends, semicircle turns, the amber dot at the end). No stock photos of people.
- **Voice:** calm and encouraging, never "hustle". Arabic copy is Egyptian dialect ("تابع النهارده", "ابدأ مجانًا").

## Taglines

- Arabic: خليك على السكة
- English: Stay on track. / Your path to the first yes.
