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
| `.railway/railway.ts` | Infrastructure as Code: build/start commands, health check, custom domain. |

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

### Settings that are not in code

Railway's IaC DSL models build, start, healthcheck, replicas, env, domains and
volumes — but **not** restart policy or sleep. These three are set on the
service and persist, and they are deliberately absent from
`.railway/railway.ts`: writing them through the raw `deploy` escape hatch
applies them but never reads them back, so every `railway config plan` would
propose the same change forever.

| Setting | Value | Why |
|---|---|---|
| `restartPolicyType` | `ON_FAILURE` | Restart a crashed container, don't loop on a clean exit. |
| `restartPolicyMaxRetries` | `10` | Give up rather than crashloop forever. |
| `sleepApplication` | `false` | A public landing page shouldn't make its first visitor wait on a cold start. Free-plan services are forced to sleep; Hobby is not. |

If the service is ever recreated, set these by hand — `railway config apply`
will not restore them.

### Port

The service pins `PORT=3000` as a Railway variable, and the public domain
targets port 3000. Both halves matter: `next start` binds whatever `PORT`
says, so if the variable is removed the app binds Railway's injected port
while the domain still routes to 3000, and every request hangs with no error
anywhere — the deployment still reports SUCCESS because the internal health
check passes. If you ever recreate the service, set the variable and the
domain's target port together.

Manual deploy from a local checkout:

```bash
railway up
```

## Not here yet

Accounts, the ledger, the admin, the app itself. The “acessar sua conta”
button is deliberately disabled until there is something behind it — when there
is, it becomes a link in `app/page.tsx`.
