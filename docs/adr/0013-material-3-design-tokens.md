# 13. Material 3 colour roles and shapes, on our own components

- Status: Accepted
- Date: 2026-10-29

## Context

The owner wants the web app to follow Google's design system, Material Design 3 (M3). The
app is built on Tailwind and shadcn/ui (Base UI) with right-to-left Arabic (ADR 0010), and
its colours were a hand-picked palette in `brand/tokens.css`. Google's own component
library, Material Web, is in maintenance mode. Moving to it would mean rewriting every
screen, and its RTL support doesn't match our setup.

## Decision

- **Keep the components and adopt M3's system:** colour roles, the shape scale, state
  layers, and M3 patterns such as the navigation bar and the floating action button.
- **Colours are generated, not picked.**
  - `web/scripts/m3-tokens.mjs` (`npm run tokens`) runs Google's
    `@material/material-color-utilities` (tonal spot scheme) on the brand teal `#00695A`.
    Tonal spot keeps primary at `#056B5C`, close to the brand.
  - The script writes `web/src/app/m3-tokens.css` (light and dark), which `globals.css`
    imports, and `web/brand/tokens.json`.
  - It fails if any text pair drops below WCAG AA (4.5:1) or a border or ring below 3:1.
- **shadcn's variable names stay.** Each one points at an M3 role:
  - `background` → `surface`
  - `card` → `surface-container-lowest` (light) or `surface-container-low` (dark)
  - `muted` → `surface-container-high`
  - `secondary` and `accent` → `secondary-container`
  - `border` → `outline-variant`, and `input` → `outline`
  - `destructive` → `error`

  The new roles `primary-container` and `surface-container-*` are Tailwind colours too.
- **Brand amber (`--yes`) and the status colours stay by hand** in `globals.css`. Amber is
  Sekka's good-news signal, not an M3 role.
- **Shape scale:** extra small 4, small 8, medium 12, large 16 and extra large 28 px, set as
  Tailwind's `--radius-*` values.

## Consequences

- One seed colour drives the palette, so a rebrand is a one-line change plus `npm run tokens`.
- Hover and selected states get a teal tint (`secondary-container`) instead of grey.
- The warm cream background (`#FAF8F4`) becomes M3's cool teal-tinted surface (`#F5FBF7`). The
  emails keep their own inline colours.
- We don't get Material Web's ripples or floating labels. State layers cover the first, and
  labels stay above fields.
