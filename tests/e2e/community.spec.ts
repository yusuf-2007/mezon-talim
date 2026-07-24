import { expect, test, type Browser, type Page } from "@playwright/test";
import { IDS, PASSWORD, USERS, testSql, wipeCommunity } from "./db";
import { LESSON1_URL, bell, bellBadge, login, openLessonTab } from "./helpers";

/**
 * The full communication loop: private question → admin bell → needs-reply
 * inbox → reply → student bell → deep link, plus the public discussion path
 * and cross-student privacy. Runs serially against tables wiped in beforeAll.
 */
test.describe.serial("discussion, ask-instructor, notifications", () => {
  test.beforeAll(async () => {
    const sql = testSql();
    await wipeCommunity(sql);
    await sql.end();
  });

  async function newSession(browser: Browser, email: string): Promise<Page> {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, email, PASSWORD);
    return page;
  }

  test("private question notifies the admin into the needs-reply inbox", async ({
    browser,
  }) => {
    const student = await newSession(browser, USERS.studentA.email);
    await openLessonTab(student, LESSON1_URL, "Ustozga savol");
    await student.fill("textarea[name=body]", "Savol: mudoraba nima?");
    await student.getByRole("button", { name: "Yuborish" }).click();
    await expect(student.getByText("Savol: mudoraba nima?")).toBeVisible();

    const admin = await newSession(browser, USERS.admin.email);
    await admin.goto("/uz/admin");
    await expect(bellBadge(admin)).toHaveText("1");
    await bell(admin).click();
    await expect(
      admin.getByText("sizga shaxsiy savol yubordi"),
    ).toBeVisible();

    // Bell click deep-links the super admin into the admin Messages panel.
    await admin.getByText("sizga shaxsiy savol yubordi").click();
    await expect(admin).toHaveURL(/admin\/messages/);
    await expect(admin.getByText(USERS.studentA.name).first()).toBeVisible();
    await expect(admin.getByText("Javob kutilmoqda")).toBeVisible();

    // Reply → the needs-reply badge clears, the student is notified.
    await admin.getByRole("button", { name: "Javob berish" }).first().click();
    await admin.fill("textarea[name=body]", "Javob: foyda taqsimoti shartnomasi.");
    await admin.getByRole("button", { name: "Yuborish" }).click();
    await expect(admin.getByText("Javob: foyda taqsimoti")).toBeVisible();
    await expect(admin.getByText("Javob kutilmoqda")).toHaveCount(0);

    await student.goto("/uz/dashboard");
    await expect(bellBadge(student)).toHaveText("1");
    await bell(student).click();
    await student.getByText("savolingizga javob berdi").click();
    await expect(student).toHaveURL(/tab=ask/);
    await expect(student.getByText("Javob: foyda taqsimoti")).toBeVisible();

    await student.context().close();
    await admin.context().close();
  });

  test("discussion reply notifies the commenter; other students see nothing private", async ({
    browser,
  }) => {
    const studentB = await newSession(browser, USERS.studentB.email);
    await openLessonTab(studentB, LESSON1_URL, "Muhokama");
    await studentB.fill("textarea[name=body]", "Ochiq izoh: juda foydali dars");
    await studentB.getByRole("button", { name: "Yuborish" }).click();
    await expect(
      studentB.locator("li", { hasText: "Ochiq izoh: juda foydali dars" }),
    ).toBeVisible();

    // Admin answers from the Messages panel discussion section.
    const admin = await newSession(browser, USERS.admin.email);
    await admin.goto(
      `/uz/admin/messages?section=discussion&courseId=${IDS.course}&lessonId=${IDS.lesson1}`,
    );
    await expect(admin.getByText("Ochiq izoh: juda foydali dars")).toBeVisible();
    await admin.getByRole("button", { name: "Javob berish" }).first().click();
    const replyForm = admin.locator("form").last();
    await replyForm.locator("textarea[name=body]").fill("Rahmat! Davom eting.");
    await replyForm.getByRole("button", { name: "Javob berish" }).click();
    await expect(admin.getByText("Rahmat! Davom eting.")).toBeVisible();

    // Student B gets the comment-reply notification.
    await studentB.goto("/uz/dashboard");
    await bell(studentB).click();
    await expect(studentB.getByText("izohingizga javob berdi")).toBeVisible();

    // Privacy: student B's bell contains nothing about A's private thread.
    await expect(studentB.getByText("mudoraba")).toHaveCount(0);

    // And student B cannot see A's private thread in the lesson.
    await openLessonTab(studentB, LESSON1_URL, "Ustozga savol");
    await expect(studentB.getByText("Savol: mudoraba nima?")).toHaveCount(0);
    await expect(studentB.getByText("Javob: foyda taqsimoti")).toHaveCount(0);

    await studentB.context().close();
    await admin.context().close();
  });

  test("student dashboard Messages shows my threads and comments", async ({
    browser,
  }) => {
    // Student A: the answered thread from test 1, continuable from here.
    const a = await newSession(browser, USERS.studentA.email);
    await a.goto("/uz/dashboard/messages");
    await expect(a.getByText("Savol: mudoraba nima?")).toBeVisible();
    await expect(a.getByText("Javob: foyda taqsimoti")).toBeVisible();
    await expect(a.getByText("Javob berildi")).toBeVisible();

    await a.fill("textarea[name=body]", "Qo'shimcha savol: dalillar qanday?");
    await a.getByRole("button", { name: "Yuborish" }).click();
    await expect(a.getByText("Qo'shimcha savol")).toBeVisible();
    // Follow-up flips the thread back to awaiting-reply.
    await expect(a.getByText("Javob kutilmoqda")).toBeVisible();
    await a.screenshot({ path: "test-results/student-messages.png", fullPage: true });

    // Student B: own comment with the admin's reply counted.
    const b = await newSession(browser, USERS.studentB.email);
    await b.goto("/uz/dashboard/messages?section=discussion");
    await expect(b.getByText("Ochiq izoh: juda foydali dars")).toBeVisible();
    await expect(b.getByText("1 ta javob")).toBeVisible();
    // B's dashboard never contains A's private thread.
    await expect(b.getByText("mudoraba")).toHaveCount(0);

    await a.context().close();
    await b.context().close();
  });
});
