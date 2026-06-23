# Mezon Ta'lim

Online learning platform (LMS) teaching **AAOIFI's Shari'ah Standards** as
structured, video-based courses in **Uzbek** (Russian fast-follow).

> Read [`CLAUDE.md`](./CLAUDE.md) for the full project guide and non-negotiables,
> and [`/docs`](./docs) for the data model and design system. This README covers
> local setup only.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
next-intl (uz/ru) · PostgreSQL · Drizzle ORM · Auth.js v5 (Phase 2) · MinIO ·
Bunny.net Stream · Click + Payme · Resend · Eskiz.

**Non-negotiables:** plain Postgres (no Supabase), modular monolith, money as
integer **tiyin** (never float), all DB access behind `lib/db` repositories, all
auth behind `lib/auth` helpers, personal data stays in-country (only Bunny video
and Resend email are off-shore).

## Prerequisites

- Node.js 20+ (developed on 26)
- Docker (for local Postgres + MinIO)

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   For local dev the defaults already match docker-compose. Generate an
#   Auth.js secret when you start Phase 2:  npx auth secret

# 3. Start local infra (Postgres + MinIO), in-country equivalents of prod
docker compose up -d

# 4. Apply database migrations
npm run db:migrate

# 5. Run the app  →  http://localhost:3000  (redirects to /uz)
npm run dev
```

MinIO console: http://localhost:9001 (user `mezon` / pass `mezon-secret`).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a new Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (dev convenience; prefer migrations) |
| `npm run db:studio` | Open Drizzle Studio |

> Never edit the schema via a GUI. Change `lib/db/schema/*`, then
> `npm run db:generate` and commit the migration in `/drizzle`.

## Project structure

```
app/[locale]/        Localized routes (uz default, ru). Root layout lives here.
components/           shadcn/ui + app components (header, footer, switcher)
lib/
  db/                 Drizzle client + schema + repositories (data-access boundary)
  auth/               getCurrentUser / requireRole helpers (auth boundary)
  payments/           Click + Payme adapter contracts (+ formatTiyin)
  video/              Bunny token signing contract
  storage/            MinIO client contract
  notifications/      Resend (email) + Eskiz (SMS) contracts
  i18n/               next-intl routing, request config, navigation
  env.ts              Zod-validated server environment
messages/             uz.json, ru.json translation catalogs
drizzle/              Generated SQL migrations (committed)
docker/               Postgres init (extensions)
docs/                 data-model.md, design-system.md
proxy.ts              next-intl locale negotiation (Next 16 "proxy" convention)
```

## Build phases

Phase 1 (Foundation) is complete. See `CLAUDE.md` §7 for the full build order:
Foundation → Auth & roles → Content/Studio → Learning → Payments → Assessments
→ Certificates → Notifications → Admin/Reports → Hardening/Deploy.
