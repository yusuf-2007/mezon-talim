---
name: code-reviewer
description: Comprehensive code review skill for the Mezon Ta'lim LMS (Next.js App Router + TypeScript + Drizzle + Auth.js + next-intl). Includes a project-tuned review checklist, the codebase's hard constraints, real antipatterns (with bugs actually hit during this build), and a static checker script. Use when reviewing pull requests, a git diff, or changed files; before committing a phase; or whenever ensuring code quality, security, or adherence to the project's non-negotiables.
---

# Code Reviewer — Mezon Ta'lim

Project-specific code review for this repository. This is **not** a generic
linter — it encodes the architecture, the legal/financial non-negotiables, and
the concrete mistakes that have already bitten this codebase.

Always read `/CLAUDE.md` first; it is the source of truth. This skill operationalizes it for review.

## When to use

- Reviewing a PR, a branch diff vs `main`, or a set of changed files.
- A self-review pass before committing a phase of work.
- Any time the user asks for a code review, quality check, or security pass.

## How to review (workflow)

1. **Scope the diff.** `git diff --stat main...HEAD` (or staged). Identify which
   risk areas are touched: `lib/payments/**`, `lib/auth/**`, `lib/db/**`,
   `**/schema/**`, `**/actions.ts`, `app/api/webhooks/**`, anything money- or PII-adjacent.
2. **Run the gates first.** `npm run typecheck && npm run lint && npm run build`.
   A green build is necessary but **not sufficient** — the worst bug this project
   hit (server actions silently not registering) passed all three.
3. **Run the static checker** for project antipatterns:
   `python3 scripts/code_quality_checker.py .` (or a path / changed-file list).
4. **Apply the checklist** in `references/code_review_checklist.md`, prioritizing
   the risk areas the diff touches.
5. **Cross-check against** `references/common_antipatterns.md` — real, repo-specific
   failure modes, several taken from bugs we actually shipped and fixed.
6. **Report** findings as `severity — file:line — what — why — fix`. Separate
   blocking (non-negotiable violations, security, money/PII) from nits.

## The non-negotiables (auto-block if violated)

Straight from `CLAUDE.md §2` and §8. A diff that violates any of these is
**blocking**, not a nit:

1. **Money is integer tiyin** (UZS × 100). Never floats for money. Use `formatTiyin()` for display.
2. **No personal data off-shore.** Only Bunny (video) and Resend (email transport)
   may be external. DB, auth, files, payments, certificates stay in-country.
3. **No Supabase / no raw ORM in UI.** All data access goes through `lib/db/`
   repositories; all auth through `lib/auth/` helpers (`getCurrentUser`, `requireRole`).
4. **Never trust the client for payments.** Enrollment happens ONLY on a verified
   provider callback (Payme JSON-RPC; Click Prepare/Complete MD5). Idempotent.
5. **All user-facing strings via next-intl.** No hardcoded UZ/RU text in components.
6. **Validate inputs with zod at the server boundary** (actions, route handlers).
7. **Migrations are committed Drizzle Kit files.** Never edit schema via a GUI.

## Reference docs

- `references/code_review_checklist.md` — the review checklist, organized by risk area.
- `references/coding_standards.md` — the project's conventions, with concrete examples.
- `references/common_antipatterns.md` — real antipatterns + the actual bugs hit this build.

## Script

- `scripts/code_quality_checker.py` — static scan for Mezon-specific antipatterns
  (money floats, raw ORM/`db` imports outside `lib/db`, missing `server-only`,
  hardcoded UI strings, `console.log`, re-exports in `"use server"` files, etc.).
  Run: `python3 scripts/code_quality_checker.py <path> [--changed] [--verbose]`.

## Tech stack (this repo)

Next.js (App Router, Turbopack) · React · TypeScript (strict) · Tailwind v4 +
shadcn/ui (Base UI) · next-intl (uz/ru) · Drizzle ORM + postgres.js · Auth.js v5
(Credentials + JWT, argon2) · MinIO (in-country storage) · Bunny Stream (video) ·
Click + Payme (payments) · Resend (email) · Eskiz (SMS) · Neon/Postgres.
