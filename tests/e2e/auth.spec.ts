import { expect, test } from "@playwright/test";
import { PASSWORD, USERS } from "./db";
import { login, openEmailForm } from "./helpers";

test.describe("authentication", () => {
  test("student logs in and lands on the dashboard", async ({ page }) => {
    await login(page, USERS.studentA.email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("super admin can open the admin panel", async ({ page }) => {
    await login(page, USERS.admin.email, PASSWORD);
    await page.goto("/uz/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("link", { name: "Xabarlar" })).toBeVisible();
  });

  test("every signed-in shell offers a way out", async ({ page }) => {
    // The regression this guards: replacing the admin shell dropped the site
    // header that had carried logout, leaving staff with no way out of /admin.
    await login(page, USERS.admin.email, PASSWORD);
    for (const url of ["/uz/admin", "/uz/dashboard"]) {
      await page.goto(url);
      await expect(page.getByRole("button", { name: "Chiqish" })).toBeVisible();
    }

    await page.getByRole("button", { name: "Chiqish" }).click();
    await expect(page).toHaveURL(/\/login|\/uz$/, { timeout: 30_000 });
  });

  test("wrong password stays on the login page", async ({ page }) => {
    await page.goto("/uz/login");
    await openEmailForm(page);
    await page.fill("input[name=email]", USERS.studentA.email);
    await page.fill("input[name=password]", "wrong-password-123");
    await page.locator("form:has(input[name=password]) button[type=submit]").click();
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test("student cannot open the admin panel", async ({ page }) => {
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto("/uz/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });
});
