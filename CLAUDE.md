# Mezon Ta'lim — Project Guide (CLAUDE.md)

> This file is read automatically by Claude Code at the start of every session.
> It is the source of truth for **what** we are building and **how**. Read it fully
> before scaffolding or writing code. Detailed specs live in `/docs`.

---

## 1. What this is

**Mezon Ta'lim** is an online learning platform (LMS) that teaches **AAOIFI's
Shari'ah Standards** as structured, **video-based courses in Uzbek** (Russian as a
fast-follow). Students enroll, watch lessons, pass assessments, and earn a
certificate. Mezon Ta'lim has an official AAOIFI affiliation.

The core loop: **Course → Modules → Video lessons → Assessments → Certificate.**

Reference platforms for tone/structure: **Taif Learning** (closest peer — an AAOIFI
training partner), **Marifa Academy** (course-page layout), **Coursera** (polish &
player). We localize this pattern for Uzbekistan and run it on in-country infra.

---

## 2. The non-negotiables (read these first)

These are hard constraints. Do not violate them without explicit sign-off.

1. **Data localization (legal).** Under Uzbek Law "On Personal Data" No. ZRU-547
   (Art. 27-1), personal data of Uzbek citizens must be stored on servers physically
   inside Uzbekistan. **All personal data** (accounts, auth, DB, file storage,
   certificates, payment records) stays in-country on the VPS. Only **non-personal
   content** may live abroad: **Bunny.net** (video) and **email delivery**. Never send
   personal data to a service outside Uzbekistan.
2. **Money is stored as integer tiyin** (UZS × 100). Never use floats for money.
3. **No Supabase.** Stack is **plain PostgreSQL + Auth.js + Drizzle ORM**. (Decision
   was made deliberately — see `/docs/architecture` section below.)
4. **Modular monolith, not microservices.** One Next.js app, one repo, one database.
5. **Keep it swap-friendly.** All data access goes through a repository/service layer
   (`lib/db/*`); all auth goes through helpers (`getCurrentUser()`, `requireRole()`).
   Never call the ORM or auth SDK directly from components/route handlers.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js** (App Router) + **React** + **TypeScript** |
| Styling | **Tailwind CSS** + **shadcn/ui** |
| i18n | **next-intl** — Uzbek (launch) + Russian (fast-follow). **No Arabic.** |
| Database | **PostgreSQL** (self-hosted, in-country) |
| ORM / migrations | **Drizzle ORM** + **Drizzle Kit** |
| Auth | **Auth.js (v5 / next-auth)** — email+password, phone OTP; Google later |
| File storage | **MinIO** (S3-compatible, self-hosted, in-country) — certificates, uploads |
| Video | **Bunny.net Stream** — token auth + DRM, view-only (no downloads) |
| Payments | **Click** + **Payme** — implemented as Next.js webhook route handlers |
| Email | **Resend** (transactional) |
| SMS | **Eskiz** (local, OTP + notifications) |
| Hosting | **PS Cloud (pscloud.uz)** VPS, Tashkent data center |

**Auth.js note:** the Credentials provider is bring-your-own-verify. Hash passwords
with **argon2** (or bcrypt). Store Auth.js tables in the same Postgres via the Drizzle
adapter. Sessions: encrypted cookie.

---

## 4. Roles (4)

- **Student** — enrolls, watches lessons in sequence, takes assessments, earns certificate.
- **Teacher** — authors courses/modules/lessons/assessments via the Studio.
- **Super Admin** — full control of users, courses, payments, settings.
- **Accountant** — payments, revenue reports, financial analysis (read-heavy on finance).

Authorization is enforced in the **app layer** (`requireRole()` guards + middleware),
not via DB row-level security. Single organization — no multi-tenancy.

---

## 5. Scope — Launch (MVP) vs. Later

The team answered **yes** to almost every feature. To ship a working paid-course-with-
certificate platform in a realistic timeframe, we phase it. **"Later" items are deferred,
not cancelled — all are on the roadmap and the schema should not block them.**

### Launch (MVP)
- **Auth & accounts:** email+password, **phone-number / SMS OTP login** (expected in UZ).
  4 roles. (B27)
- **Content:** courses → modules → video lessons. Bunny video, **view-only, no
  downloads** (B6=No). Free **preview lessons** (B1).
- **Learning:** **sequential unlock** (B2), **progress tracking & resume** (B3),
  **playback speed** (B4), **subtitles** (B5), **student notes** (B7), **bookmarks**
  (B8), **glossary / izohli lug'at** (B9).
- **Assessment:** per-lesson quizzes + **self-assessment 1–5** "how well I understood"
  (B11), module tests (B12), **final exam** 70%+ to pass (B13), **timed** (B14),
  **limited attempts: 3 tries, 24h between final-exam attempts** (B15), **answer review
  after passing** (B16), **one mock exam** (B17).
- **Certificate:** auto-generated **PDF certificate** + **public verification page** (B18).
- **Payments:** **Click + Payme**, enrollment gated on verified server callback.
- **Notifications (transactional):** **email** (welcome, receipt, certificate) (B29) +
  **SMS** (payment confirm, exam reminders) (B30).
- **Admin:** user/course management, **analytics dashboard** (sales, enrollments,
  completion) (B35).
- **Studio:** teacher authoring for courses/modules/lessons/assessments.
- **Help:** static **FAQ / help center** (B33).

### Later (roadmap — build without rebuild)
- Community: comments under lessons (B19), **public discussion panel with anonymous
  posting** (B20 — note: team does *not* want private instructor Q&A; route everything
  to a public panel), discussion forum (B22), ratings & reviews (B21).
- Live sessions / webinars (B23, "not for all courses").
- **Telegram:** community link-out + **bot notifications** (B31, B24) — see TBD #3.
- Gamification (B25, "not childish"), learning streaks (B10), referral program (B26).
- Google / social login (B28).
- Blog / articles (B32), live chat / support widget (B34), deep teacher analytics (B36).
- Channel preference: let students choose SMS / email / Telegram per notification (B29 extra).

Full mapping in `/docs/scope` if split out; otherwise this section is authoritative.

---

## 6. Open decisions — TBD (pending Mezon team)

**Do not block scaffolding on these.** Build the foundation; where a decision is needed,
implement the neutral/recommended default below behind config or a clearly-marked TODO,
and keep the schema flexible. Yusuf will confirm these with the Mezon team.

1. **Pricing model** — *TBD.* Recommended default: **per-course purchase with ~1-year
   access** (mirrors Taif). Build `courses.price_tiyin` + `courses.access_duration_days`
   + enrollment `expires_at` so subscription can be added later. Do not hardcode prices.
2. **Certificate authority** — *TBD.* Recommended default: **Mezon issues its own
   course-completion certificate** (the auto PDF); the **official AAOIFI credential comes
   from AAOIFI's own exam** (Mezon may help register). Build Mezon's own cert + verification
   now; leave a hook for an AAOIFI exam-registration handoff.
3. **Telegram integration depth** — *TBD.* Recommended default for launch: **link-out to
   a TG channel/group + a notification bot**; deep integration (TG login, community sync)
   later.
4. **Exam integrity / proctoring** — *TBD.* Recommended default: **light** — randomized
   question bank, single timed window, attempt limits (already speced). Full proctoring later.
5. **Languages at launch** — *TBD.* Recommended default: **Uzbek at launch, Russian
   fast-follow.** Regardless, build the content model **bilingual from day one** (per-locale
   fields) so Russian is data entry, not a refactor.
6. **Live sessions** — *TBD.* Recommended default: **integrate** (Zoom / YouTube Live /
   Telegram) rather than build in-house; per-course toggle. Deferred to "Later" anyway.

---

## 7. Build order

Build and verify module by module. Don't start a module until the previous one runs.

1. **Foundation** — scaffold Next.js, Tailwind, shadcn/ui, next-intl, Drizzle + Postgres
   connection, env config, repository/service layer skeleton, base layout + design tokens.
2. **Auth & 4 roles** — Auth.js (email+password, phone OTP), `getCurrentUser()` /
   `requireRole()`, sign-up / login / reset, role-gated route groups.
3. **Content model + Studio** — courses/modules/lessons CRUD, Bunny upload/playback
   wiring, preview flag.
4. **Learning flow (student)** — catalog, course detail, player (sequential unlock,
   progress/resume, speed, subtitles, notes, bookmarks, glossary).
5. **Payments** — Click + Payme webhook route handlers, enrollment gating on verified
   callback, idempotency, receipts. (Use sandbox creds.)
6. **Assessments** — lesson quizzes + self-assessment, module tests, final exam (timed,
   attempt limits, 70% pass, mock, answer review).
7. **Certificates** — auto PDF generation, storage in MinIO, public verification page.
8. **Notifications** — Resend email + Eskiz SMS for transactional events.
9. **Admin & reports** — user/course management, analytics dashboard.
10. **Hardening & deploy** — QA, security pass, in-country deploy to PS Cloud, go-live.

Matches the proposal's phasing: design/review → MVP build → production build → testing/launch.

---

## 8. Conventions

- **Language:** TypeScript everywhere, strict mode.
- **Data access:** only through `lib/db/` repositories. No raw ORM calls in UI/route layers.
- **Auth access:** only through `lib/auth/` helpers.
- **Money:** integer **tiyin**; a `formatTiyin()` helper for display. Never float.
- **i18n:** all user-facing strings via next-intl; no hardcoded UZ/RU text in components.
- **Server-first:** prefer Server Components + server actions; client components only when needed.
- **Validation:** validate all inputs (zod) at the server boundary.
- **Payments:** never trust client; enroll only on a verified provider callback. Verify
  signatures (Payme JSON-RPC; Click Prepare/Complete + MD5).
- **Secrets:** env vars only; never commit keys. Provide `.env.example`.
- **Migrations:** Drizzle Kit migration files in the repo — never edit schema via a GUI.
- **Commits:** small, module-scoped, conventional commits.
- **Code review:** before committing a phase, run the **`code-reviewer`** skill
  (`.claude/skills/code-reviewer/`). At minimum: `typecheck` + `lint` + `build`,
  then `python3 .claude/skills/code-reviewer/scripts/code_quality_checker.py . --changed`,
  then apply `references/code_review_checklist.md` to the touched risk areas.
  Green gates are necessary but not sufficient — verify behaviour for logic-heavy changes.

---

## 9. Suggested repo structure

```
/app
  /[locale]
    /(marketing)      landing, about, faq, blog (later)
    /(auth)           login, signup, reset
    /(student)        dashboard, catalog, course, player, exams, certificates
    /(studio)         teacher authoring
    /(admin)          admin + accountant
  /api
    /webhooks/click
    /webhooks/payme
/lib
  /db                 drizzle client, schema, repositories (the swap boundary)
  /auth               Auth.js config + getCurrentUser/requireRole
  /payments           click, payme adapters
  /video              bunny token signing
  /storage            minio client
  /notifications      resend, eskiz
  /i18n               next-intl config + messages
/components           shadcn/ui + app components
/docs                 architecture, data-model, design-system, scope
/drizzle              migrations
.env.example
```

---

## 10. Reference docs in this repo

- `/docs/data-model.md` — full Postgres schema.
- `/docs/design-system.md` — brand (navy + gold), typography, components, page blueprints.
- `KICKOFF-PROMPT.md` — the prompt used to start the build (history/reference).

---

## 11. Real-world prerequisites (owner: Yusuf, in parallel — not code)

These have lead times and gate launch, not coding. Start the slow ones now:
- **Click + Payme merchant onboarding** (slowest — start first; need sandbox + prod creds).
- **PS Cloud VPS** — confirm it is physically in **Tashkent** (not Kazakhstan).
- Domain + SSL, **Bunny.net** account, **Resend** + **Eskiz** accounts.
- **Data-privacy lawyer** check on current ZRU-547 wording + any DB-registration step.
