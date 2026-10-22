# Sekka redesign plan

The plan for rebuilding `web/` to match the Sekka mockups. Do one step per session or PR, in order. Each step lists the mockup to match, the files to change, what must not break, and how to check it.

Read `brand/BRAND.md` first. It has the tokens and the logo rules this plan relies on.

## The mockups

`brand/mockups/` has one PNG (what it should look like) and one static HTML file (exact spacing, sizes and colours) per screen:

| Mockup | Screen | Width |
|---|---|---|
| `02-sign-up-ar` | Register (Arabic), pattern for every auth page | 390 |
| `03-board-ar`, `03-board-en` | Applications board on a phone | 390 |
| `04-landing-ar`, `04-landing-en` | Home page hero on desktop | 1440 |
| `06-email-header` | Follow-up reminder email | 600 |
| `01-home-screen-icon` | App icon on a phone home screen (reference only) | 390 |

How to use them:
- **Match the layout, spacing, sizes, radii and colours.** Translate inline styles to Tailwind classes and the theme tokens (`bg-primary`, `text-muted-foreground`, `bg-yes`, ...), never hard-coded hex.
- **The sample data is fake.** Companies, dates, counts and the extra "name" field are there to fill the picture. Real data and the real form fields win.
- **All copy goes through `messages/en.json` and `messages/ar.json`.** Reuse existing keys where they exist and add keys where they don't.
- **Behaviour stays.** Drag and drop, the move menu, optimistic updates, server actions, Suspense boundaries, aria labels, and the `dir`/RTL handling must keep working. This is a visual redesign.
- Where a mockup and this plan disagree, this plan wins (it was written against the real code).

## Shared pieces (create in step 1, reuse after)

- `components/brand/logo.tsx`: `<Logo variant="horizontal" | "symbol" />`. It picks the Arabic or Latin lockup from the active locale and renders it as `<img>` with `alt={APP_NAME}`. Copy the SVGs from `brand/logo/` to `public/brand/`.
- `components/brand/road.tsx`: the road motif as inline SVG.
  - `<RoadLine />`: a thin decorative track with a teal start dot and an amber end dot, used on the auth pages and in the email.
  - `<RoadIllustration stages={...} />`: the winding road from the landing mockup.
  - **For RTL, use the RTL path data from `04-landing-ar.html`; never flip with CSS.** A CSS flip mirrors the text labels too.
  - Decorative versions get `aria-hidden`. The illustration gets `role="img"` and a translated `aria-label`.
- Status colours: add these to `globals.css` and point `STATUS_DOT` in `components/applications/status-badge.tsx` at them (`bg-[var(--status-applied)]` or `@theme` colours). The dots are decorative because the status text carries the meaning. Amber is only for offer and accepted.

  ```css
  :root {
    --status-wishlist: oklch(0.766 0.019 81.3);     /* #B9B2A6 */
    --status-applied: oklch(0.769 0.075 180.5);      /* #7CC4B6 */
    --status-screening: oklch(0.627 0.101 178.7);    /* #2E9C89 */
    --status-interviewing: oklch(0.466 0.086 178.4); /* #00695A */
    --status-offer: oklch(0.780 0.144 69.4);        /* #F2A541 */
    --status-accepted: oklch(0.647 0.140 62.6);     /* #C9781A */
    --status-rejected: oklch(0.652 0.010 171.6);     /* #8A928F */
    --status-withdrawn: oklch(0.853 0.013 82.4);    /* #D3CEC5 */
  }
  .dark {
    --status-wishlist: oklch(0.625 0.015 82.4);     /* #8C877E */
    --status-applied: oklch(0.837 0.065 181.3);      /* #9AD8CC */
    --status-screening: oklch(0.742 0.110 179.3);    /* #4CC2AD */
    --status-interviewing: oklch(0.627 0.101 178.7); /* #2E9C89 */
    --status-offer: oklch(0.812 0.129 71.8);        /* #F5B35C */
    --status-accepted: oklch(0.702 0.141 66.3);     /* #D98B2B */
    --status-rejected: oklch(0.561 0.012 174.0);     /* #6E7774 */
    --status-withdrawn: oklch(0.431 0.011 179.1);    /* #4A5250 */
  }
  ```

- Follow-up chip, used on the board and the follow-ups page:
  - due or overdue: `rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary`
  - upcoming: `rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground`
  - **No red.** A late follow-up isn't an error, and Sekka stays calm. Both chips pass AA in light and dark mode.

---

## Step 0. Brand foundation

Do "Applying the brand" in `brand/BRAND.md` (tokens, `--color-yes`, icons, manifest), plus:

1. `src/config/brand.ts`: default `APP_NAME` to `"Sekka"`. Check `.env.example` and `render.yaml` for `NEXT_PUBLIC_APP_NAME` and update them.
2. `scripts/icons.mjs` still draws the old placeholder icons, and `npm run icons` would overwrite the new ones. Rewrite it to copy the files from `brand/icons/` to the same destinations it writes today (see `BRAND.md`), keeping the header comment's list of outputs.
3. The font is already IBM Plex Sans Arabic in `app/[locale]/layout.tsx`. Leave it as it is.
4. Add the status colours above.

Check: `npm run check`. Then light, dark, Arabic and English on `/applications` and `/login` should all show the new colours and nothing should look broken.

## Step 1. App shell and header

Mockup: the top and bottom of `03-board-*`.

Files: `components/site-header.tsx`, `app/[locale]/(app)/layout.tsx`, new `components/brand/logo.tsx`.

- Header: replace the `APP_NAME` text with `<Logo variant="horizontal" />` (height about 28 px), linking to `/`.
- Phones (below `md`): add a bottom tab bar fixed to the bottom with the four real destinations (Applications, Follow-ups, Stats, Settings). Each tab is an icon over a label with a 44 px minimum touch target, the active one in `text-primary font-semibold` with `aria-current="page"`. Add bottom padding to `<main>` so content clears it. Log out stays in the header.
- `md` and up: keep the current header nav, restyled. Inactive is `text-muted-foreground`, active is `text-foreground` with `aria-current`.
- The current route needs the pathname. Put the tab bar in a small client component and keep the layout a server component.

Check: 390 px wide in both languages. The tab order runs right to left in Arabic automatically through `dir`, so don't reverse it by hand.

## Step 2. Applications board

Mockups: `03-board-ar`, `03-board-en`.

Files: `app/[locale]/(app)/applications/page.tsx`, `components/applications/board.tsx`, `components/applications/status-badge.tsx`.

- Page header: the `Logo variant="symbol"` (about 30 px), then the title, then "Add application". On phones the button is a 44 px square icon button with `aria-label={t("add")}`. From `sm` up it keeps its text.
- **Offer banner (new):** when any application has status `offer`, show one banner above the board for the most recent one: `bg-yes text-yes-foreground rounded-2xl`. The title is "{company} sent you an offer" with the role underneath, and the whole banner links to that application's page. The mockup's "reply by Thursday" has no data behind it, so leave it out. Add message keys in both languages. This is the main place amber appears in the app.
- **Stage chips (new, phones only):** a horizontally scrolling row of pill links, one per status with its count, each linking to `#column-<status>`. The columns already have those ids, so this needs no client JS. Hide it from `md` up.
- Columns: `bg-muted rounded-2xl p-3`. The header shows the status name (semibold) and the count (muted, `ms-auto`). Keep the drop-target styling.
- Cards: `bg-card rounded-xl border p-3.5`.
  - First row: a 34 px initial tile (company's first letter, `bg-primary/10 text-primary rounded-lg font-semibold`, `aria-hidden`), then company (semibold) over role (muted), then the existing menu button at the end.
  - Second row: "Applied {date}" (muted, `text-xs`) at the start and the follow-up chip at the end.
- Keep `draggable`, the menu, `useOptimistic`, the error alert and the drag hint exactly as they work now.
- Empty state: swap the Kanban icon for a small `<RoadLine />`. Keep the copy and the button.

Check: `npm run check`, then drag a card, move one with the menu, and open the page at 390 px and 1440 px in both languages. Compare the 390 px view with the mockup PNGs.

## Step 3. Auth pages

Mockup: `02-sign-up-ar` (use the same pattern for login, forgot, reset and verify).

Files: `app/[locale]/(auth)/layout.tsx`, `components/auth/auth-page.tsx`, `components/auth/form-parts.tsx`, `components/auth/register-form.tsx` (spacing only).

- Layout: page background `bg-background`. No site header on phones, just the centred `<Logo variant="horizontal" />` (about 36 px tall) with the language switcher in a corner. From `sm` up, keep the header.
- `AuthPage`: no card border or shadow on phones (it sits on the page). From `sm` up, a `bg-card rounded-2xl border` card, `max-w-sm`.
  - Above the title: `<RoadLine />`, start dot at the reading start and amber at the end.
  - Title `text-2xl font-semibold`, description muted `text-base`.
- Fields: label `text-sm font-medium`. Input `h-12 rounded-xl bg-card`, with a 2 px `--primary` ring on focus. Keep the LTR handling for email and password.
- Submit button `h-13 rounded-2xl text-base font-semibold`, full width.
- **Keep the real fields.** Register has email and password only. Don't add the mockup's name field. Keep the Google button where it is (above the form) and the "or" divider.

Check: `npm run check` and the e2e auth tests (`npm run e2e` if they're set up). Then visually check register and login at 390 px in Arabic against the mockup.

## Step 4. Home page

Mockups: `04-landing-en`, `04-landing-ar`.

Files: `components/home-hero.tsx`, `app/[locale]/page.tsx`, `components/site-header.tsx`, `messages/*.json`.

- Hero: two columns from `lg` up (text, then illustration), stacked on phones with the text first.
  - `h1` is `Home.tagline`, `text-5xl lg:text-7xl font-semibold` (Arabic `font-bold`), `text-balance`.
  - Then the intro and **one** primary button "Start free" (`h-14 px-7 rounded-2xl text-lg`) to `/register`.
- Move "Log in" out of the hero into the site header (a plain link next to the language switcher) on the home page.
- Illustration: `<RoadIllustration />`. The stage labels come from the `Status` messages, and the final label "Yes!" / "أيوه!" is a new key.
- Keep the three feature cards below the hero. Restyle them as `bg-card rounded-2xl border p-6` with the icon in `text-primary`.
- Copy changes (update both message files):
  - `Home.tagline`: "Stay on track." / "خليك على السكة"
  - `Home.intro`: "Sekka keeps every job application in one place and tells you when to follow up, until someone says yes." / "سكة بتجمع كل تقديماتك على الشغل في مكان واحد، وبتفكّرك تتابع، لحد ما حد يقولك أيوه."
  - `Home.getStarted`: "Start free" / "ابدأ مجانًا"
  - `Metadata.description` may stay.
- Update `components/home-hero.test.tsx` for the single CTA.

Check: `npm run check`, then 1440 px and 390 px in both languages. In Arabic the road must run from right to left.

## Step 5. Follow-ups page

No separate mockup. Use the board's card style and the follow-up chip.

Files: `components/follow-ups/follow-up-item.tsx`, `app/[locale]/(app)/follow-ups/page.tsx`.

- Items: `bg-card rounded-xl border p-4` with the initial tile from the board cards.
- Replace `text-destructive` with the follow-up chip (due or overdue in the teal style, upcoming in the muted style). Keep the "Done" and snooze buttons and their aria labels.

Check: `npm run check` and the page with overdue, today and upcoming items.

## Step 6. Reminder email

Mockup: `06-email-header`.

Files: `src/applytrack/mail/templates/_layout.html`, `_macros.html`, `follow_up_reminder.*.html` (the backend, outside `web/`).

- Copy `brand/logo-email/sekka-email-latin.png` and `sekka-email-arabic.png` to `web/public/brand/email/`. **Email apps don't show SVG, so the email must use PNGs at absolute URLs.** Build the URL from the same setting the templates already use for `link` and `settings_link`, and pick the Arabic or Latin logo by `locale`.
- `_layout.html`:
  - Outer background `#F1EEE8`.
  - The logo (width 140, Latin; 105, Arabic) above the card, replacing the bold `app_name` text, with `alt="{{ app_name }}"`.
  - The card is `#FFFFFF`, radius 20.
  - Add an optional `{% block header %}`: a `#00695A` band with white text, radius 20 on the top corners, holding the title.
- `follow_up_reminder.*.html`: put "Time to follow up" / "وقت المتابعة" in the header band. Keep the list of items as it is, but colour overdue items `#00574B` instead of red `#b91c1c`.
- `_macros.html` button: background `#00695A`, radius 12, padding 14×24.
- Skip the mockup's "Remind me in 3 days" link unless an endpoint for it exists.
- Keep everything table-based with inline styles (the comment in `_layout.html` explains why), and keep the plain-text versions in step.

Check: the backend's mail tests, and render one reminder in each language with `python -m applytrack.mail` (see `mail/__main__.py`).

## Step 7 (optional, owner decides). Arabic voice

The app's Arabic copy is Modern Standard Arabic. The mockups use Egyptian dialect ("قدّمت", "تابع النهارده", "عايز أقدّم"). Changing the voice means rewriting `messages/ar.json` throughout, not just a few screens. **Don't do this unless the owner asks for it.**
