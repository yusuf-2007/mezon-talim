import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import { testSql } from "./db";
import { openEmailForm } from "./helpers";

/**
 * Phone-first sign-up and sign-in — the primary path in Uzbekistan.
 *
 * The code is seeded straight into `phone_otps` rather than read back from the
 * SMS provider. That keeps the real verification path under test (the row is
 * hashed, single-use and time-boxed exactly as in production) without adding a
 * test-only way to read a live code, which would be a backdoor worth more to an
 * attacker than the test is worth to us.
 *
 * Seeding also survives the sixty-second resend cooldown: requesting a code
 * while ours is still live leaves it in place, so the number we seed is the
 * number the form accepts.
 */

const CODE = "1234";
const NEW_PHONE = "+998901110011";
const KNOWN_PHONE = "+998901110022";

async function seedCode(phone: string) {
  const sql = testSql();
  await sql`delete from phone_otps where phone = ${phone}`;
  await sql`
    insert into phone_otps (phone, code_hash, expires_at)
    values (${phone}, ${await hash(CODE)}, now() + interval '5 minutes')`;
  await sql.end();
}

async function removeUser(phone: string) {
  const sql = testSql();
  await sql`delete from users where phone = ${phone}`;
  await sql`delete from rate_limits where key like ${`%${phone}%`}`;
  await sql.end();
}

test.describe("phone entry", () => {
  test("phone is the default credential, email is the alternative", async ({ page }) => {
    await page.goto("/uz/login");
    await expect(page.locator("input[name=phone]")).toBeVisible();
    await expect(page.locator("input[name=password]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Email va parol bilan kirish" }),
    ).toBeVisible();
  });

  test("/signup redirects to the unified entry", async ({ page }) => {
    await page.goto("/uz/signup");
    await expect(page).toHaveURL(/\/uz\/login$/);
  });

  test("the email form is still reachable", async ({ page }) => {
    await page.goto("/uz/login");
    await openEmailForm(page);
    await expect(page.locator("input[name=email]")).toBeVisible();
  });

  test("an unknown number is asked for a name before the account exists", async ({
    page,
  }) => {
    await removeUser(NEW_PHONE);
    await seedCode(NEW_PHONE);

    await page.goto("/uz/login");
    // Typed the way a number is spoken in UZ — the schema normalises it.
    await page.fill("input[name=phone]", "901110011");
    await page.click("button[type=submit]");

    await expect(page.locator("input[name=code]")).toBeVisible({ timeout: 30_000 });
    // Grouped for reading, from the normalised value.
    await expect(page.getByText("+998 90 111 00 11")).toBeVisible();

    await page.fill("input[name=code]", CODE); // auto-submits on the fourth digit
    await expect(page.locator("input[name=fullName]")).toBeVisible({ timeout: 30_000 });

    await page.fill("input[name=fullName]", "Yangi Talaba");
    await page.selectOption("select[name=occupation]", "business_owner");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // The name and occupation were captured, not left blank.
    const sql = testSql();
    const [row] = await sql`
      select full_name, occupation, phone_verified from users where phone = ${NEW_PHONE}`;
    await sql.end();
    expect(row.full_name).toBe("Yangi Talaba");
    expect(row.occupation).toBe("business_owner");
    expect(row.phone_verified).not.toBeNull();
  });

  test("a known number signs straight in, with no name step", async ({ page }) => {
    const sql = testSql();
    await sql`delete from users where phone = ${KNOWN_PHONE}`;
    await sql`
      insert into users (phone, phone_verified, full_name, name, role)
      values (${KNOWN_PHONE}, now(), 'Mavjud Talaba', 'Mavjud Talaba', 'student')`;
    await sql`delete from rate_limits where key like ${`%${KNOWN_PHONE}%`}`;
    await sql.end();
    await seedCode(KNOWN_PHONE);

    await page.goto("/uz/login");
    await page.fill("input[name=phone]", KNOWN_PHONE);
    await page.click("button[type=submit]");
    await expect(page.locator("input[name=code]")).toBeVisible({ timeout: 30_000 });
    await page.fill("input[name=code]", CODE);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.locator("input[name=fullName]")).toHaveCount(0);
  });

  test("a wrong code is rejected and spends an attempt", async ({ page }) => {
    await removeUser(NEW_PHONE);
    await seedCode(NEW_PHONE);

    await page.goto("/uz/login");
    await page.fill("input[name=phone]", NEW_PHONE);
    await page.click("button[type=submit]");
    await expect(page.locator("input[name=code]")).toBeVisible({ timeout: 30_000 });

    await page.fill("input[name=code]", "9999");
    await expect(page.getByText(/noto'g'ri/i)).toBeVisible({ timeout: 30_000 });

    const sql = testSql();
    const [row] = await sql`
      select attempts from phone_otps where phone = ${NEW_PHONE} order by created_at desc limit 1`;
    await sql.end();
    expect(row.attempts).toBeGreaterThan(0);
  });

  test("a code is single-use", async ({ page, context }) => {
    await removeUser(NEW_PHONE);
    await seedCode(NEW_PHONE);

    await page.goto("/uz/login");
    await page.fill("input[name=phone]", NEW_PHONE);
    await page.click("button[type=submit]");
    await expect(page.locator("input[name=code]")).toBeVisible({ timeout: 30_000 });
    await page.fill("input[name=code]", CODE);
    await expect(page.locator("input[name=fullName]")).toBeVisible({ timeout: 30_000 });

    // A second browser replaying the same code must not get in.
    await context.clearCookies();
    const other = await context.newPage();
    await other.goto("/uz/login");
    await other.fill("input[name=phone]", NEW_PHONE);
    await other.click("button[type=submit]");
    await expect(other.locator("input[name=code]")).toBeVisible({ timeout: 30_000 });
    await other.fill("input[name=code]", CODE);
    await expect(other.getByText(/noto'g'ri/i)).toBeVisible({ timeout: 30_000 });
    await other.close();
  });
});
