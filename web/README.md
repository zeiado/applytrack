# ApplyTrack web app

The web app for ApplyTrack, in Arabic and English. Next.js (App Router), TypeScript,
Tailwind CSS and shadcn/ui. Design decisions: [ADR 0010](../docs/adr/0010-web-app.md).

## Run it

Requires Node.js 24+. The API should be running on :8000 (`make run` in the repo root).

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000 (redirects to /ar or /en)
```

| Command | What it does |
|---------|--------------|
| `npm run check` | Lint, type check and unit tests |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run gen:api` | Regenerate `src/lib/api/schema.ts` from `openapi.json` |

After changing the API, run `make openapi` in the repo root. It exports the API's
OpenAPI schema to `openapi.json` and regenerates the typed client. CI fails if you forget.

## Where things are

| Path | What |
|------|------|
| `src/app/[locale]/` | Pages, one folder per route, under the language (`/ar/...`, `/en/...`) |
| `src/components/` | Components; `ui/` is shadcn/ui (add more with `npx shadcn add <name>`) |
| `src/i18n/` | Languages and routing. Use `Link` and `useRouter` from `@/i18n/navigation` |
| `messages/` | Text in Arabic and English. Every key must exist in both |
| `src/lib/api/` | Typed API client (server only) and the generated schema |
| `src/config/brand.ts` | The product name |

## Rules of thumb

- Write all text in `messages/*.json`, never in components.
- Use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`) instead of `ml-`, `mr-`, `left-`, `right-`, so layouts flip in Arabic.
- Call the API only from server code (`src/lib/api/client.ts` is `server-only`).
