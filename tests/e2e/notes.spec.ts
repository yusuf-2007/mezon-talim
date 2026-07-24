import { expect, test } from "@playwright/test";
import { PASSWORD, USERS } from "./db";
import { LESSON1_URL, login, openLessonTab } from "./helpers";

test.describe("lesson notes", () => {
  test("timestamp input auto-masks and the note shows a formatted chip", async ({
    page,
  }) => {
    await login(page, USERS.studentA.email, PASSWORD);
    await openLessonTab(page, LESSON1_URL, "Eslatmalar");

    const ts = page.locator("input[name=timestamp]");
    await ts.pressSequentially("111111");
    await expect(ts).toHaveValue("11:11:11");

    await page.fill("textarea[name=body]", "E2E eslatma sinovi");
    await page.getByRole("button", { name: "Eslatma qo'shish" }).click();

    const note = page.locator("li", { hasText: "E2E eslatma sinovi" });
    await expect(note).toBeVisible();
    await expect(note).toContainText("11:11:11");

    // Cleanup: delete the note again.
    await note.getByRole("button", { name: "O'chirish" }).click();
    await expect(note).toHaveCount(0);
  });
});
