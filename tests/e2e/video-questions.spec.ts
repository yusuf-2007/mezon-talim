import { expect, test } from "@playwright/test";
import { IDS, PASSWORD, USERS, testSql } from "./db";
import { login } from "./helpers";

/**
 * Studio authoring for in-video popup questions. (The popup itself needs a
 * real Bunny embed, which CI doesn't have — the full player loop is verified
 * manually/locally; this spec locks down authoring + validation + delete.)
 */
test.describe.serial("in-video questions authoring", () => {
  test.beforeAll(async () => {
    const sql = testSql();
    await sql`delete from video_questions`;
    await sql.end();
  });

  test("admin creates, sees, and deletes a question", async ({ page }) => {
    page.on("dialog", (d) => void d.accept());
    await login(page, USERS.admin.email, PASSWORD);
    await page.goto(`/uz/studio/courses/${IDS.course}`);

    const row = page.locator("li", { hasText: "Birinchi dars" }).first();
    await row.getByRole("button", { name: "Savollar" }).click();
    await page.getByRole("button", { name: "+ Savol qo'shish" }).click();

    // Masked timestamp input
    const ts = page.locator("input[name=timestamp]");
    await ts.pressSequentially("0130");
    await expect(ts).toHaveValue("01:30");

    await page.fill("input[name=promptUz]", "CI savol: Riba nima?");
    await page.fill("input[name=option0Uz]", "Foyda");
    await page.fill("input[name=option1Uz]", "Sudxo'rlik");
    await page.locator("input[name=correctIndex][value='1']").check();
    await page.getByRole("button", { name: "Savol qo'shish", exact: true }).click();

    // .last(): the lesson <li> nests the question <li>; we want the inner one.
    const created = page.locator("li", { hasText: "CI savol: Riba nima?" }).last();
    await expect(created).toBeVisible();
    await expect(created).toContainText("1:30");
    await expect(created).toContainText("✓");

    // Delete (confirm dialog auto-accepted above)
    await created.getByRole("button", { name: "O'chirish", exact: true }).click();
    await expect(created).toHaveCount(0);
  });

  test("student cannot author questions (studio is gated)", async ({ page }) => {
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto(`/uz/studio/courses/${IDS.course}`);
    await expect(page).not.toHaveURL(new RegExp(`studio/courses/${IDS.course}$`));
  });
});
