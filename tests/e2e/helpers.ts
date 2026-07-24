import { expect, type Page } from "@playwright/test";
import { IDS } from "./db";

export const LESSON1_URL = `/uz/learn/${IDS.course}/${IDS.lesson1}`;

export async function login(page: Page, email: string, password: string) {
  await page.goto("/uz/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  // Every role leaves the login page on success.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
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
