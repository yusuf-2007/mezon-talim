# Common Antipatterns — Mezon Ta'lim

Repo-specific failure modes. The ⭐ ones are **bugs we actually shipped and fixed**
during this build — they passed `typecheck`/`lint`/`build`, so a reviewer must
catch them by reading, not by trusting the gates.

---

## ⭐ 1. Re-exporting a non-action from a `"use server"` file
**The single worst bug of the build.** In `lib/assessments/actions.ts`:

```ts
"use server";
import { getExamOverview, startOrResumeAttempt } from "./service";
export async function startExamAction(id: string) { /* ... */ }
export { getExamOverview }; // ❌ re-exporting a plain service fn
```

Every export in a `"use server"` module is compiled into the server-action
registry. Re-exporting an imported plain function **corrupted the registry**, so
`startExamAction` silently failed to register. Symptom: `UnrecognizedActionError
— Server Action "…" was not found on the server` at form submit — on dev *and*
prod — while the build stayed green.

**Fix:** a `"use server"` file exports ONLY its own async actions. Import
`getExamOverview` directly from `./service` where it's used.
**Review rule:** grep changed `actions.ts` files for `export {`, `export const`,
`export default` of anything that isn't an async function. (`export type` is fine.)

## ⭐ 2. Relying on the DB URL `sslmode` param instead of explicit SSL
`postgres(env.DATABASE_URL, { max: 10 })` with `?sslmode=require` in the URL.
Worked in Node and on Vercel, but **Turbopack dev ignored the URL param**, tried a
plaintext connection to Neon, and parsed the TLS handshake bytes as JSON →
`SyntaxError: ... JSON at position 512` on every request.

**Fix:** configure SSL explicitly in `lib/db/client.ts` — `ssl: false` for local
Docker, `ssl: "require"` for managed hosts, plus `prepare: false` (pooler-safe).
**Review rule:** any new postgres.js client must set `ssl` explicitly, not via URL.

## ⭐ 3. `await`ing a `redirect()` that should be returned
```ts
await redirectLocalized("/dashboard"); // ❌ breaks TS narrowing, swallows throw
return redirectLocalized("/dashboard"); // ✅
```
`redirectLocalized` returns `Promise<never>` and works by throwing. `await`ing it
discards control-flow narrowing and can mask the redirect. **Always `return` it.**

## ⭐ 4. Multi-join aggregation fan-out
Joining two one-to-many tables and summing inflates the total:
```ts
.leftJoin(enrollments, ...).leftJoin(payments, ...)
.select({ revenue: sql`sum(payments.amount_tiyin)` }) // ❌ ×N enrollments
```
2 enrollments × 2 payments reported **200M** revenue instead of 100M.
**Fix:** correlated subqueries, or `COUNT(DISTINCT)` / separate aggregates.

## ⭐ 5. Importing `server-only` modules into a standalone tsx script
Seed/util scripts run by `tsx` are NOT in an RSC context; importing a module that
pulls `server-only` (or a repository that does) throws. **Keep scripts
self-contained** — connect to postgres directly, import only pure modules.

## 6. Money as a float
```ts
const price = 49.90;                 // ❌
priceTiyin: bigint("price_tiyin")    // ✅ integer tiyin (UZS×100)
```
Never float math on money. Convert only for display with `formatTiyin`.

## 7. Raw ORM / `db` access outside `lib/db`
```ts
// in a page/component/route/action:
import { db } from "@/lib/db/client"; // ❌
const courses = await db.select()...; // ❌
```
Use a repository. If a method doesn't exist, add it to the repo — don't reach past
the boundary. Same rule for auth: no `auth()`/adapter calls outside `lib/auth`.

## 8. Hardcoded UI strings / missing the other locale
```tsx
<Button>Boshlash</Button>            // ❌ hardcoded
<Button>{t("start")}</Button>         // ✅ and add `start` to BOTH uz.json + ru.json
```
A key present in `uz.json` but missing in `ru.json` throws only at runtime on the
ru route — the build won't catch it.

## 9. Trusting the client for money/access
Enrollment, "paid" status, or access granted from a client action or an unverified
request. **Only `markPaidAndEnroll` (after a verified provider callback) grants
access.** Webhooks must verify signatures and be idempotent.

## 10. Sending PII off-shore
Any new `fetch` to a US/EU SaaS carrying a name/email/phone/payment detail violates
ZRU-547. Allowed external: Bunny (video, non-personal) and Resend (email transport).
Everything else stays in-country (Postgres, MinIO, Eskiz).

## 11. Leaking answer/correctness data to the client
Exam runner state must strip `isCorrect` before sending questions to the browser;
review (correct answers + explanations) is gated to a passing attempt. Check any
new payload sent to a `"use client"` component for fields that shouldn't ship.

## 12. Missing `"server-only"` guard
A repository/service without `import "server-only";` can be accidentally imported
into a client bundle, leaking DB credentials/logic. Every server module declares it.

## 13. Base UI `Button` misuse
Use `<Button render={<Link href="…" />}>`, not `asChild`. The project's Button is
Base UI, not Radix.

## 14. Private folders / dev routes left in
Folders prefixed `_` are private (not routed) — don't put a live API route under
`app/api/_dev/...` and expect it to resolve. And remove temporary `app/api/dev*`
verification routes before committing.
