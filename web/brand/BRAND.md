# Sekka brand

How Sekka looks. Follow this for any UI work in `web/`. All paths below are relative to `web/`.

For the full redesign of the app's screens, follow `brand/REDESIGN.md` step by step. It builds on this file.

## What's in `brand/`

| File | Use |
|---|---|
| `tokens.json` | The generated Material 3 palette (light and dark) with measured contrast ratios. Written by `npm run tokens`; don't edit it |
| `icons/` | Final app icons and favicons, named for where they go (see below) |
| `logo/` | Outlined SVG lockups in `color`, `mono` and `reversed` |

## Applying the brand (one-time)

1. **Colours.** Sekka follows Material Design 3 (`docs/adr/0013-material-3-design-tokens.md`). `scripts/m3-tokens.mjs` generates every colour role from the brand teal `#00695A` into `src/app/m3-tokens.css`, which `globals.css` imports. To change a colour, change the script and run `npm run tokens`; it fails if a text pair drops below WCAG AA. Brand amber (`--yes`) and the status colours stay by hand in `globals.css`.
2. **Icons.** Copy over the existing placeholders:
   - `brand/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `icon.svg` → `public/icons/`
   - `brand/icons/favicon.ico` → `src/app/favicon.ico`
   - `brand/icons/favicon.svg` → `src/app/icon.svg` (the bare symbol, switches teal in dark mode)
   - `brand/icons/apple-icon.png` → `src/app/apple-icon.png` (180×180, full bleed)
3. **Manifest.** In `src/app/manifest.ts` set `background_color: "#F5FBF7"` (the M3 surface). `theme_color` stays `#00695a`. Icon paths don't change.
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
- **Contrast:** every generated pair passes WCAG AA (see `tokens.json`). Don't invent new colours; use the M3 roles (`primary`, `primary-container`, `secondary`, `surface-container-*`, `muted-foreground`, `border`).
- **Material 3:**
  - Surfaces get lighter or darker by container level, not by shadows.
  - Hover and press show a state layer.
  - Buttons are pills.
  - Corners follow the shape scale: 4, 8, 12, 16 or 28 px.
- **Backgrounds:** public pages (home, sign-in, legal) may show the faint road-map pattern. App screens stay on the plain tinted surface so data reads clearly.
- **Illustrations:** simple line drawings from the road motif (a thick teal stroke with round ends, semicircle turns, the amber dot at the end). No stock photos of people.
- **Voice:** calm and encouraging, never "hustle". Arabic copy is Egyptian dialect ("تابع النهارده", "ابدأ مجانًا").

## Taglines

- Arabic: خليك على السكة
- English: Stay on track. / Your path to the first yes.
