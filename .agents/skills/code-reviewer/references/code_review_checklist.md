# Code Review Checklist — Mezon Ta'lim

Work top-down, but spend your time where the diff actually lands. Each item:
**check → why it matters here**. ⛔ = blocking (non-negotiable), ⚠️ = strong, 💡 = nit.

---

## 0. Gates (run before reading code)
- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean (0 warnings — we keep it at zero).
- [ ] `npm run build` compiles.
- [ ] ⚠️ Remember: green gates are necessary, not sufficient. Server-action
      registration, runtime SSL, and i18n key gaps all pass the build.

## 1. Architecture & boundaries (`CLAUDE.md §2.5, §8`)
- [ ] ⛔ No `drizzle`/`db`/raw SQL imported outside `lib/db/`. UI, route handlers,
      and actions call **repositories** (`lib/db/repositories/*`), never the ORM.
- [ ] ⛔ No direct Auth.js SDK calls in components/routes. Auth goes through
      `lib/auth` helpers: `getCurrentUser()`, `requireUser()`, `requireRole()`.
- [ ] ⛔ Every file under `lib/db/`, `lib/**/service.ts`, `lib/storage`,
      `lib/notifications`, and other server-only modules starts with `import "server-only";`.
- [ ] ⚠️ New repositories are exported from `lib/db/repositories/index.ts`.
- [ ] 💡 New cross-cutting helpers live in the right `lib/*` folder, not inlined in a page.

## 2. Money (`CLAUDE.md §2.2`)
- [ ] ⛔ All money is integer **tiyin** (`bigint`/`number` mode), never a float/decimal.
- [ ] ⛔ No floating-point arithmetic on money (`/100` only for display via `formatTiyin`).
- [ ] ⚠️ Amounts crossing a provider boundary use the provider's unit correctly
      (Click expects so'm; Payme expects tiyin) — conversions are explicit and commented.

## 3. Payments & enrollment (`CLAUDE.md §8`, build order 5)
- [ ] ⛔ Enrollment is created ONLY in `markPaidAndEnroll` (the single verified-paid path).
      No enrollment from a client action except the explicit dev-enroll fallback.
- [ ] ⛔ Webhook signatures verified server-side (Payme JSON-RPC auth; Click MD5).
- [ ] ⛔ Idempotent: a repeated callback for an already-`paid` payment is a no-op.
- [ ] ⚠️ Side effects after enroll (receipt email/SMS) are **best-effort** and never
      throw back into the payment path.

## 4. Server Components & Server Actions
- [ ] ⛔ In a `"use server"` file, **every export is an async action**. No re-exporting
      a plain function/value, no `export const`/`export {x}` of non-actions — it
      silently breaks the action registry (see antipatterns: this bug shipped once).
- [ ] ⛔ `redirectLocalized(...)` / `redirect(...)` is **returned**, not `await`ed, so TS
      control-flow narrowing works and the throw isn't swallowed.
- [ ] ⚠️ Server actions validate inputs (zod) and re-check auth + ownership server-side;
      never trust an id from the client without an ownership check.
- [ ] ⚠️ Prefer Server Components; add `"use client"` only when interactivity needs it.
- [ ] 💡 `revalidatePath` is called after mutations that change a rendered list.

## 5. Data localization & privacy (`CLAUDE.md §2.1`) ⛔
- [ ] ⛔ No personal data sent to an off-shore service. Only Bunny (video) and Resend
      (email transport) are allowed external; everything else (DB, files, certs,
      payments, PII) stays in-country.
- [ ] ⛔ New third-party calls reviewed: does the payload contain user PII? If so, it
      must be an in-country service (MinIO, Eskiz, local Postgres) — not a US/EU SaaS.
- [ ] ⚠️ Certificates (contain names) archive to MinIO, never an off-shore bucket.

## 6. i18n (`CLAUDE.md §8`)
- [ ] ⛔ No hardcoded user-facing UZ/RU strings in components — use `useTranslations` /
      `getTranslations`. Keys exist in **both** `messages/uz.json` and `messages/ru.json`.
- [ ] ⚠️ Bilingual content read via `pickLocale(value, locale)` (falls back to uz).
- [ ] ⚠️ New `LocalizedText` DB fields populate `uz` (always) and `ru` (when available).
- [ ] 💡 No missing-key gaps between uz and ru (the build won't catch these).

## 7. Auth & authorization
- [ ] ⛔ Role-gated routes/actions call `requireRole(...)`; the layout guard is not
      the only check (deep links can bypass layouts).
- [ ] ⚠️ `getCurrentUser()` is resilient (returns null on a bad/stale session) — no 500s.
- [ ] ⚠️ Passwords hashed with argon2; never logged. Secrets via env only.
- [ ] ⚠️ Sensitive admin actions (role change, status change, cert revoke) are audited.

## 8. Database & migrations
- [ ] ⛔ Schema changes ship a committed Drizzle Kit migration (`npm run db:generate`);
      never a hand-edited GUI change.
- [ ] ⚠️ New queries that join multiple one-to-many tables don't fan out and inflate
      `SUM`/`COUNT` — use correlated subqueries or `COUNT(DISTINCT)` (real bug we hit).
- [ ] ⚠️ The postgres.js client configures SSL explicitly (local=off, managed=on) and
      `prepare:false`; don't rely on the URL `sslmode` param alone (Turbopack ignores it).
- [ ] 💡 `jsonb` columns typed with `.$type<LocalizedText>()` / proper generics.

## 9. Security
- [ ] ⛔ All external input (form data, route params, webhook bodies) validated with zod
      at the boundary before use.
- [ ] ⚠️ No SQL string interpolation of user input (Drizzle params / `sql` bindings only).
- [ ] ⚠️ No secrets/PII in logs. No `.env` values echoed. `.env` stays gitignored.
- [ ] ⚠️ Capability-by-code endpoints (e.g. `/verify/:code`, cert PDF) leak nothing
      beyond what verification intends; revoked items 404.

## 10. UI / components
- [ ] ⚠️ shadcn/Base UI `Button` uses the `render` prop (not `asChild`).
- [ ] 💡 Tailwind uses the project's navy/gold design tokens, not ad-hoc hex.
- [ ] 💡 No leaked answer/PII data into client components (strip correctness flags, etc.).

## 11. Hygiene
- [ ] 💡 No stray `console.log` (use intentional `console.error`/`info` only where meaningful).
- [ ] 💡 No dead code, unused imports, or TODO without an owner/phase tag.
- [ ] 💡 Comments match surrounding density; explain *why*, not *what*.
- [ ] 💡 Temporary/dev-only routes (`app/api/dev*`) removed before commit.
