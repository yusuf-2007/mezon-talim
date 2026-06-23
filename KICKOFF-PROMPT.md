# Claude Code — Kickoff Prompt (Mezon Ta'lim)

> How to use: put `CLAUDE.md` and the `/docs` folder in an empty git repo, open Claude
> Code in that folder, and paste the prompt below as your first message. It scaffolds the
> foundation **only** and stops for your review — we build module by module, not all at once.

---

```
You are building Mezon Ta'lim, an LMS for AAOIFI Shari'ah Standards courses in Uzbek.

FIRST: read CLAUDE.md and everything in /docs (data-model.md, design-system.md) in full.
That is the source of truth. Follow its non-negotiables exactly:
- Plain PostgreSQL + Auth.js (v5) + Drizzle ORM. NO Supabase.
- Modular monolith, one Next.js app/repo/database.
- Money is integer tiyin (UZS x 100), never float.
- All data access behind lib/db repositories; all auth behind lib/auth helpers
  (getCurrentUser, requireRole). Never call the ORM or auth SDK directly from
  components or route handlers.
- Personal data stays in-country; only Bunny (video) and Resend (email) are external.
- The 6 "TBD (pending Mezon team)" decisions in CLAUDE.md section 6 are NOT blockers:
  implement the recommended defaults behind config / clearly-marked TODOs, keep the
  schema flexible, and do NOT hardcode prices or assume a final answer.

SCOPE FOR NOW — Phase 1 (Foundation) ONLY. Do not build auth flows, payments, or
features yet. In this phase:
1. Scaffold a Next.js (App Router) + TypeScript (strict) project with Tailwind CSS,
   shadcn/ui, and next-intl (locales: uz default, ru; no Arabic).
2. Set up Drizzle ORM + Drizzle Kit with a Postgres connection via env vars, and a
   docker-compose for local Postgres + MinIO.
3. Create the lib/ structure from CLAUDE.md section 9: lib/db (drizzle client + empty
   repository layer + the schema file translating /docs/data-model.md), lib/auth,
   lib/payments, lib/video, lib/storage, lib/notifications, lib/i18n. Stub modules with
   typed interfaces; no implementations yet beyond the DB client.
4. Implement the design tokens from /docs/design-system.md as the Tailwind theme
   (navy + gold, the listed scale) and wire Inter (body) + Source Serif 4 (headings)
   with Cyrillic subsets. Build a base layout with the navy-hero / light-content shell
   and a placeholder landing page using the tokens, plus a language switcher.
5. Write the full Drizzle schema for the MVP tables in /docs/data-model.md (users +
   Auth.js tables, courses/modules/lessons, enrollments/progress, assessments/questions/
   attempts, certificates, payments, notifications, audit_log). Generate the first
   migration. Do not create the "Later-feature" tables yet.
6. Add .env.example with every key we will need (DB, Auth secret, Bunny, Click, Payme,
   Resend, Eskiz, MinIO), README setup steps, and scripts (dev, db:generate, db:migrate).

CONVENTIONS: TypeScript strict, zod validation at server boundaries, server-first
(Server Components + server actions), conventional commits, small module-scoped commits.

WHEN DONE with Phase 1: stop. Summarize what you scaffolded, how to run it locally
(docker-compose up, migrate, dev), list the env vars I must fill, and propose the exact
plan for Phase 2 (Auth & 4 roles). Wait for my review before continuing.
```

---

### After Phase 1 passes review, continue with one short follow-up per phase, e.g.:

- **Phase 2:** "Build Auth & the 4 roles per CLAUDE.md: Auth.js with email+password
  (argon2) and phone-number OTP login via Eskiz, getCurrentUser/requireRole helpers,
  sign-up/login/reset pages, and role-gated route groups. Stop and summarize."
- **Phase 3:** content model + Studio authoring + Bunny wiring.
- **Phase 4:** student learning flow (catalog, course detail, player).
- **Phase 5:** Click + Payme webhooks + enrollment gating (sandbox creds).
- **Phase 6:** assessments. **Phase 7:** certificates. **Phase 8:** notifications.
- **Phase 9:** admin & reports. **Phase 10:** hardening + PS Cloud deploy.

Keep each phase scoped, reviewed, and committed before starting the next.
