# Moeda Social Desapego

Landing page da **Desapego**, a moeda social do Festival Desapegue-se.

Live: <https://desapego.festivaldesapeguese.com.br>

This is deliberately a real Next.js app rather than a static page: the Desapego
becomes a full currency app (accounts, ledger, admin) and this repo is where
that grows. Today it serves exactly one static route.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Hosting | Railway (Railpack builder) |
| CI | GitHub Actions → `railway up` on push to `main` |

## Local

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm run build && npm start   # production build
```

## Layout

| Path | What it is |
|---|---|
| `app/page.tsx` | The page. All copy lives here, in pt-BR. |
| `app/layout.tsx` | `<html>`, fonts, and all SEO/OpenGraph metadata. |
| `app/globals.css` | Every style. No CSS framework — the page is small enough not to need one. |
| `app/icon.png` | Favicon (the “1” numeral off the cédula). |
| `public/cedula-*.webp` | The cédula artwork, cropped from the original mock-up. |
| `public/og.jpg` | 1200×630 social preview card. |
| `railway.json` | Build and start commands, health check. |

### Bandwidth

Images are pre-sized WebP committed to `public/`, served with a one-year
`immutable` cache header (`next.config.ts`). Nothing is generated per request
and nothing is read from a database. Keep it that way — if an image needs to
change, add a new filename rather than mutating an existing one, so the cache
header stays honest.

## Deploy

Pushing to `main` builds, type-checks, and deploys. The workflow needs:

- Secret `RAILWAY_TOKEN` — a Railway **project** token (Project → Settings → Tokens).
- Optional variable `RAILWAY_SERVICE` — service name, defaults to `desapego`.

Manual deploy from a local checkout:

```bash
railway up
```

## Not here yet

Accounts, the ledger, the admin, the app itself. The “acessar sua conta”
button is deliberately disabled until there is something behind it — when there
is, it becomes a link in `app/page.tsx`.
