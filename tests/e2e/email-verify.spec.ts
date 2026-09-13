import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PASSWORD, USERS, testSql } from "./db";
import { login } from "./helpers";

/**
 * Email-address verification.
 *
 * Like the phone suite, the token is seeded rather than read back out of a
 * delivered message: the row stores only a SHA-256 of it, so there is nothing
 * to read, and adding a way to read one would be a backdoor. Seeding exercises
 * the real confirm path — hashed lookup, single use, expiry — end to end.
 */

const CLAIMED = "claimed@e2e.test";

async function resetVerification(email: string) {
  const sql = testSql();
  await sql`update users set email_verified = null where email = ${email}`;
  await sql`delete from users where email = ${CLAIMED}`;
  await sql`delete from email_verifications`;
  await sql`delete from rate_limits where key like ${"email:%"}`;
  await sql.end();
}

test.describe("email verification", () => {
  test("an unverified address offers a way to verify it", async ({ page }) => {
    await resetVerification(USERS.studentB.email);
    await login(page, USERS.studentB.email, PASSWORD);
    await page.goto("/uz/dashboard/settings");

    // The regression this guards: an address already on the account, never
    // confirmed, whose only control was a button labelled "change email".
    // Exact: the hint sentence below the row also contains this word, and
    // getByText matches substrings case-insensitively.
    await expect(page.getByText("Tasdiqlanmagan", { exact: true })).toBeVisible();
    const verify = page.getByRole("button", { name: "Tasdiqlash", exact: true });
    await expect(verify).toBeVisible();

    await verify.click();
    await expect(page.getByText(/manziliga yuborildi/)).toBeVisible({ timeout: 30_000 });

    const sql = testSql();
    const claims = await sql`select email, consumed_at from email_verifications`;
    await sql.end();
    expect(claims.length).toBe(1);
    expect(claims[0].email).toBe(USERS.studentB.email);
    expect(claims[0].consumed_at).toBeNull();
  });

  test("following the link marks the address verified", async ({ page }) => {
    await resetVerification(USERS.studentB.email);

    const raw = "e2etoken".repeat(8); // 64 chars, same shape as a real token
    const sql = testSql();
    const [user] = await sql`select id from users where email = ${USERS.studentB.email}`;
    await sql`
      insert into email_verifications (user_id, email, token_hash, expires_at)
      values (${user.id}, ${USERS.studentB.email},
              ${createHash("sha256").update(raw).digest("hex")},
              now() + interval '1 day')`;
    await sql.end();

    await page.goto(`/api/verify-email/${raw}?locale=uz`);
    await expect(page).toHaveURL(/\/uz\/verify-email\?status=ok/);
    await expect(page.getByText(/tasdiqlandi/i)).toBeVisible();

    const after = testSql();
    const [row] = await after`
      select email_verified from users where email = ${USERS.studentB.email}`;
    const [claim] = await after`select consumed_at from email_verifications`;
    await after.end();
    expect(row.email_verified).not.toBeNull();
    expect(claim.consumed_at).not.toBeNull(); // single use
  });

  test("a spent link still reads as confirmed, not as an error", async ({ page }) => {
    // Mail scanners follow links before a person does, and so does a
    // double-click; neither should send someone chasing a replacement.
    await resetVerification(USERS.studentB.email);
    const raw = "spenttok".repeat(8);
    const sql = testSql();
    const [user] = await sql`select id from users where email = ${USERS.studentB.email}`;
    await sql`
      insert into email_verifications (user_id, email, token_hash, expires_at)
      values (${user.id}, ${USERS.studentB.email},
              ${createHash("sha256").update(raw).digest("hex")},
              now() + interval '1 day')`;
    await sql.end();

    await page.goto(`/api/verify-email/${raw}?locale=uz`);
    await expect(page).toHaveURL(/status=ok/);
    await page.goto(`/api/verify-email/${raw}?locale=uz`);
    await expect(page).toHaveURL(/status=ok/);
  });

  test("an unconfirmed new address is not attached to the account", async ({ page }) => {
    await resetVerification(USERS.studentB.email);
    await login(page, USERS.studentB.email, PASSWORD);
    await page.goto("/uz/dashboard/settings");

    await page.getByRole("button", { name: "Emailni o'zgartirish" }).click();
    await page.fill("input[name=email]", CLAIMED);
    await page.locator("form:has(input[name=email]) button[type=submit]").click();
    await expect(page.getByText(/havola yubordik/)).toBeVisible({ timeout: 30_000 });

    const sql = testSql();
    const [row] = await sql`select email from users where id = (
      select id from users where email = ${USERS.studentB.email})`;
    const claims = await sql`select email from email_verifications where email = ${CLAIMED}`;
    await sql.end();

    // The claim exists, but the unique users.email slot is untouched — that is
    // what stops an unverified claim locking out the address's real owner.
    expect(claims.length).toBe(1);
    expect(row.email).toBe(USERS.studentB.email);
  });

  test("an address already on another account is refused", async ({ page }) => {
    await resetVerification(USERS.studentB.email);
    await login(page, USERS.studentB.email, PASSWORD);
    await page.goto("/uz/dashboard/settings");

    await page.getByRole("button", { name: "Emailni o'zgartirish" }).click();
    await page.fill("input[name=email]", USERS.admin.email);
    await page.locator("form:has(input[name=email]) button[type=submit]").click();
    await expect(page.getByText(/boshqa hisobga biriktirilgan/)).toBeVisible({
      timeout: 30_000,
    });
  });
});
