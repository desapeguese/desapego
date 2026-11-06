# Moeda Social Desapego

Landing page e app da carteira da **Desapego**, a moeda social do Festival
Desapegue-se.

Live: <https://desapego.festivaldesapeguese.com.br>

O escopo completo está em [docs/PRD.md](docs/PRD.md). Hoje o repositório tem a
landing e as **Etapas 1 e 2** do app: cadastro, login sem senha, perfis, o
livro de transações e a carteira (saldo, histórico, receber por QR, enviar pela
câmera ou e-mail, avisos em tempo real, PWA instalável). As telas de Caixa e
Admin são as próximas etapas.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Banco | PostgreSQL, com Drizzle ORM e migrações SQL em `drizzle/` |
| Login | Better Auth: código por e-mail e Google |
| E-mail | Resend (API HTTP) |
| Testes | Vitest, com PGlite (Postgres em WASM) |
| Hosting | Railway (Railpack builder) |
| CI | GitHub Actions → `railway up` on push to `main` |

## Local

Não precisa de Docker: o banco de desenvolvimento é o PGlite, servido no
protocolo do Postgres.

```bash
npm install
cp .env.example .env.local   # preencha BETTER_AUTH_SECRET
npm run db:local             # terminal 1: banco em 127.0.0.1:5433
npm run db:migrate           # aplica as migrações
npm run dev                  # http://localhost:3000
```

Sem `RESEND_API_KEY`, o código de login é impresso no terminal do `npm run dev`.

```bash
npm test                     # testes do livro de transações
npm run db:generate          # nova migração depois de mudar lib/db/schema.ts
npm run build && npm start   # build de produção (o start aplica as migrações)
```

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Postgres. Sem ela a landing funciona, mas `/app` não. |
| `BETTER_AUTH_SECRET` | sim | Assina as sessões. Em produção, sem ela o login se recusa a funcionar. |
| `BETTER_AUTH_URL` | sim | Endereço público, sem barra no fim. |
| `RESEND_API_KEY` | em produção | Envio do código de login. |
| `EMAIL_FROM` | não | Remetente. O domínio precisa estar verificado no Resend. |
| `ADMIN_EMAILS` | sim, no início | E-mails, separados por vírgula, que são Admin. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | não | Sem as duas, o botão "Entrar com Google" não aparece. Redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`. |
| `PGPOOL_MAX` | não | Só com o banco local: `1`. |

## Identidade visual do app

O app segue a cédula, não a landing: papel verde-claro, tinta verde, numerais
em Barlow Condensed, a faixa de guilhochê em tudo o que mostra um valor e as
cores das pessoas da roda nos avatares. O desenho de referência é o canvas
“Carteira Desapego — identidade visual” no Claude Design
(<https://claude.ai/artifact/Urhp4o2sYHNpjwGjWNQFqb>, privado do autor).

- Cada conta tem um número de série no formato da cédula (`DES-2026-00412`):
  ano de criação + `conta.numero`, sequencial.
- Cada transação é mostrada por um número curto (`7F3A-91C2`), os oito
  primeiros dígitos do identificador. É o que a pessoa mostra ao Caixa para
  pedir estorno.
- A cor de uma pessoa é derivada do id dela (`corDaPessoa` em `lib/formato.ts`),
  então é a mesma em todas as telas.

## Regras que o código garante

- **Todo movimento de moeda passa por `lib/ledger.ts`.** Nenhum outro arquivo
  escreve em `conta` ou `transacao`. É ali que moram soma zero, limites,
  permissões por perfil, idempotência e estorno, e é isso que `npm test` cobre.
- **`transacao` é imutável.** Um trigger no banco recusa `UPDATE`, `DELETE` e
  `TRUNCATE`; erros se corrigem com estorno.
- **Papel, `ativo` e aceite dos termos nunca vêm do cliente.** São lidos do
  banco a cada pedido em `lib/sessao.ts`; toda página do app começa por
  `exigirPessoa()`.
- **O QR de receber é um link** `…/app/enviar?para=<id da pessoa>`. Lido dentro
  do app vai direto para o valor; lido pela câmera do celular abre o app na
  mesma tela. O endereço vem de `BETTER_AUTH_URL`.
- **O service worker não guarda páginas nem dados.** Só troca o erro do
  navegador pela tela "sem conexão", vale apenas em `/app` e só é registrado em
  produção.
- **Os avisos em tempo real são um barramento em memória** (`lib/eventos.ts`),
  com a mesma restrição de réplica única do item abaixo. Quem perde um aviso
  não perde dados: o app também consulta o servidor periodicamente.
- **O limitador de pedidos de código é em memória** (`lib/limite.ts`), o que só
  vale com uma réplica. Antes de escalar para duas, mover para o banco.

## Layout

| Path | What it is |
|---|---|
| `app/page.tsx` | A landing. All copy lives here, in pt-BR. |
| `app/layout.tsx` | `<html>`, fonts, and all SEO/OpenGraph metadata. |
| `app/globals.css` | Every style. No CSS framework. A landing é escura; o app (`.app`) é claro, ver “Identidade visual”. |
| `app/app/(carteira)/` | Páginas que exigem login: carteira, `receber/`, `enviar/`, `historico/`, `transacao/[id]/`, `conta/`. |
| `app/app/pecas.tsx`, `app/fontes.ts` | Peças visuais compartilhadas (a nota, avatares, barra inferior) e as fontes do app. |
| `app/app/entrar/`, `app/app/cadastro/` | Login e primeiro acesso. |
| `app/api/eventos/` | Avisos em tempo real (Server-Sent Events). |
| `app/manifest.ts`, `public/sw.js`, `public/sem-conexao.html` | PWA: manifesto, service worker e a tela sem internet. |
| `public/icone-*-v1.png` | Ícones do PWA, gerados por `scripts/gerar-icones.mjs`. |
| `app/termos/` | Termos de uso e privacidade (rascunho, ver abaixo). |
| `app/api/auth/` | Rotas do Better Auth. |
| `lib/ledger.ts` | O livro da moeda. |
| `lib/auth.ts`, `lib/sessao.ts` | Configuração do login e leitura da pessoa logada. |
| `lib/db/schema.ts` | Esquema do banco. |
| `drizzle/` | Migrações SQL, aplicadas por `scripts/migrar.mjs`. |
| `tests/` | Testes do livro. |
| `app/icon.png` | Favicon (the “1” numeral off the cédula). |
| `public/cedula-*-v2.webp` | The 2026 cédula artwork. Suffixed because the cache header is `immutable` — a new design needs a new filename, never an overwrite. |
| `public/og-v2.jpg` | 1200×630 social preview card, built from the cédula front. |
| `.railway/railway.ts` | Infrastructure as Code: build/start commands, health check, custom domain. |

### Bandwidth

Images are pre-sized WebP committed to `public/`, served with a one-year
`immutable` cache header (`next.config.ts`). The landing is static: nothing is
generated per request and it never touches the database. Keep it that way — if
an image needs to change, add a new filename rather than mutating an existing
one, so the cache header stays honest.

## Deploy

Pushing to `main` type-checks, runs the ledger tests, builds, and deploys. The
start command applies pending migrations before `next start`; without
`DATABASE_URL` it skips them, so the landing stays up even with no database. The workflow needs:

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

- Etapas 3 a 5 do [PRD](docs/PRD.md): Caixa, Admin, passkey e 2FA.
- **Ícone definitivo do app.** Os ícones do PWA são um "1" desenhado em código,
  provisório até existir a arte oficial em alta resolução.
- **Termos de uso definitivos.** `app/termos/page.tsx` é um rascunho sem
  revisão jurídica. Ao publicar o texto final, mude `VERSAO_TERMOS` em
  `lib/sessao.ts`: é ela que fica gravada em cada aceite.
