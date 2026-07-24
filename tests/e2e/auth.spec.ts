import { expect, test } from "@playwright/test";
import { PASSWORD, USERS } from "./db";
import { login } from "./helpers";

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

  test("wrong password stays on the login page", async ({ page }) => {
    await page.goto("/uz/login");
    await page.fill("input[name=email]", USERS.studentA.email);
    await page.fill("input[name=password]", "wrong-password-123");
    await page.click("button[type=submit]");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test("student cannot open the admin panel", async ({ page }) => {
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto("/uz/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });
});
