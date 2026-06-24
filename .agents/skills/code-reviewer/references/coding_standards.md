# Coding Standards — Mezon Ta'lim

The conventions a change is reviewed against. Source of truth: `CLAUDE.md §8`.
This expands each rule with what "good" looks like in this repo.

---

## Language & types
- TypeScript everywhere, **strict**. No `any` without a written reason; prefer
  `unknown` + narrowing. Derive types from Drizzle schema / zod where possible.
- Money is `integer tiyin`. `LocalizedText = { uz: string; ru?: string }`.

## Data access — the repository boundary
- All reads/writes go through `lib/db/repositories/*`. Each repo file:
  - starts with `import "server-only";`
  - exposes a typed object (e.g. `coursesRepository`) with async methods
  - is re-exported from `lib/db/repositories/index.ts`
- Components / route handlers / actions import the repository, never `db`.
- Aggregations that touch multiple one-to-many relations use correlated
  subqueries or `COUNT(DISTINCT)` to avoid fan-out.

## Auth
- Only `lib/auth` helpers: `getCurrentUser()` (nullable, resilient),
  `requireUser()` (redirects anon), `requireRole(...roles)` (redirects unauthorized).
- Guard at the page/action level too, not only in a layout.
- Passwords: argon2 (`lib/auth/password`). Never log secrets.

## Server-first
- Default to Server Components and server actions. Add `"use client"` only for
  real interactivity (state, effects, event handlers).
- `"use server"` files export **only** async actions (see antipatterns #1).
- `return redirectLocalized(...)` — never `await` it.

## Validation
- Validate every external input with zod at the server boundary (server actions,
  route handlers, webhook bodies). Parse, then use the typed result.

## i18n
- All user-facing copy via next-intl (`getTranslations` server, `useTranslations`
  client). Add keys to **both** `messages/uz.json` and `messages/ru.json`.
- Render bilingual DB content with `pickLocale(value, locale)`.

## Money & payments
- `formatTiyin(amountTiyin, locale)` for display only.
- Enroll only via `markPaidAndEnroll` after a verified provider callback; verify
  signatures (Payme JSON-RPC auth, Click MD5); make callbacks idempotent.
- Provider integrations are **config-gated** with dev fallbacks so missing creds
  (Eskiz/Bunny/Click/Payme/Resend) never block local work — they log to console.

## Database & migrations
- Schema lives in `lib/db/schema/*`. Change it, then `npm run db:generate` and
  commit the migration. Never edit the DB via a GUI.
- The postgres.js client sets `ssl` explicitly and `prepare: false`.

## Files & money/PII placement
- Personal data and generated files (certificates) stay in-country: Postgres + MinIO.
- External services limited to Bunny (video) and Resend (email transport).

## Errors & side effects
- Side effects triggered by a core flow (notifications after payment, cert archive)
  are **best-effort**: wrapped in try/catch, logged, and never thrown back into the
  core path.

## Style & hygiene
- Match surrounding code: naming, comment density, idioms. Comments say *why*.
- No stray `console.log`. Use `console.error`/`info` deliberately.
- Conventional commits, small and module-scoped. End commit messages with the
  project's `Co-Authored-By` trailer.
- `.env` is gitignored; update `.env.example` (no secrets) when adding a var.

## Verify before commit
- `npm run typecheck && npm run lint && npm run build` all clean.
- For logic-heavy changes (grading, payments, analytics), verify behavior directly
  (unit-style check or a temporary dev route hit over HTTP) — green build ≠ correct.
- Remove any temporary verification routes/data afterward.
