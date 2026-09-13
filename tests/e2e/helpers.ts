import { expect, type Page } from "@playwright/test";
import { IDS } from "./db";

export const LESSON1_URL = `/uz/learn/${IDS.course}/${IDS.lesson1}`;

/**
 * Sign in with email + password.
 *
 * The entry screen leads with phone, so the email form has to be revealed
 * first — it is no longer on the page at load.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/uz/login");
  await openEmailForm(page);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.locator("form:has(input[name=password]) button[type=submit]").click();
  // Every role leaves the login page on success.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Reveal the email + password panel on the unified entry screen. A no-op when
 * phone login is disabled, since the email form is then the whole screen.
 */
export async function openEmailForm(page: Page) {
  const toggle = page.getByRole("button", { name: "Email va parol bilan kirish" });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.waitForSelector("input[name=password]", { timeout: 15_000 });
}

/** Open a player tab ("Eslatmalar", "Muhokama", "Ustozga savol", …). */
export async function openLessonTab(page: Page, url: string, tabName: string) {
  await page.goto(url);
  await page.getByRole("tab", { name: tabName }).click();
}

/** The header notification bell (aria-label starts with "Bildirishnomalar"). */
export function bell(page: Page) {
  return page.locator("button[aria-label^=Bildirishnomalar]");
}

export function bellBadge(page: Page) {
  return bell(page).locator("span");
}
