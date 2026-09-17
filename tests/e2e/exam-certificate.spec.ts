import { expect, test, type Page } from "@playwright/test";
import { IDS, PASSWORD, USERS, testSql } from "./db";
import { login } from "./helpers";
import uz from "../../messages/uz.json";

/**
 * Final exam → certificate. The rule under test: a certificate exists only
 * after a scored final exam is passed at or above the threshold, it is
 * publicly verifiable by code, and its PDF is served. A failed attempt must
 * leave no certificate behind.
 */

const EXAM_ID = "00000000-0000-4000-8000-0000000000e1";
const CORRECT = "To'g'ri javob";
const WRONG = "Noto'g'ri javob";

async function seedExam() {
  const sql = testSql();
  const [u] = await sql`select id from users where email = ${USERS.studentA.email}`;
  await sql`delete from certificates where user_id = ${u.id}`;
  await sql`delete from attempts where user_id = ${u.id}`;
  await sql`delete from assessments where id = ${EXAM_ID}`;
  await sql`delete from rate_limits`;
  await sql`
    insert into assessments (id, course_id, type, title, pass_threshold_pct, max_attempts, is_scored, is_published)
    values (${EXAM_ID}, ${IDS.course}, 'final_exam', ${sql.json({ uz: "Yakuniy imtihon", ru: "Итоговый экзамен", en: "Final exam" })}, 70, 3, true, true)`;
  for (const i of [0, 1]) {
    const [q] = await sql`
      insert into questions (assessment_id, type, order_index, prompt, points)
      values (${EXAM_ID}, 'single', ${i}, ${sql.json({ uz: `Savol ${i + 1}`, ru: `Вопрос ${i + 1}`, en: `Question ${i + 1}` })}, 1)
      returning id`;
    await sql`insert into question_options (question_id, order_index, label, is_correct) values
      (${q.id}, 0, ${sql.json({ uz: CORRECT, ru: CORRECT, en: CORRECT })}, true),
      (${q.id}, 1, ${sql.json({ uz: WRONG, ru: WRONG, en: WRONG })}, false)`;
  }
  // Prerequisite: every lesson completed.
  for (const lessonId of [IDS.lesson1, IDS.lesson2]) {
    await sql`insert into lesson_progress (user_id, lesson_id, completed) values (${u.id}, ${lessonId}, true)
      on conflict (user_id, lesson_id) do update set completed = true`;
  }
  await sql.end();
  return u.id as string;
}

async function certificateFor(userId: string) {
  const sql = testSql();
  const [c] = await sql`select verification_code from certificates where user_id = ${userId} and course_id = ${IDS.course}`;
  await sql.end();
  return c?.verification_code as string | undefined;
}

/** Start the exam and answer both questions with `answer`. */
async function sitExam(page: Page, answer: string) {
  await page.goto(`/uz/exam/${EXAM_ID}`);
  await page.getByRole("button", { name: uz.Exam.start, exact: true }).click();
  await expect(page).toHaveURL(/\/exam\/attempt\//, { timeout: 30_000 });

  // exact: "To'g'ri javob" is a substring of "Noto'g'ri javob".
  await page.getByRole("button", { name: answer, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(uz.Exam.next) }).click();
  await page.getByRole("button", { name: answer, exact: true }).click();

  await page.getByRole("button", { name: uz.Exam.submit, exact: true }).first().click();
  await expect(page.getByText(uz.Exam.submitConfirm)).toBeVisible();
  await page.getByRole("button", { name: uz.Exam.submit, exact: true }).last().click();
  await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
}

test.describe("final exam and certificate", () => {
  test("passing issues a certificate that verifies publicly and serves a PDF", async ({ page, request }) => {
    const userId = await seedExam();
    await login(page, USERS.studentA.email, PASSWORD);
    await sitExam(page, CORRECT);

    await expect(page.getByText(uz.Exam.passed, { exact: true })).toBeVisible();
    await expect(page.getByText(uz.Exam.yourScore.replace("{pct}", "100"))).toBeVisible();

    const code = await certificateFor(userId);
    expect(code).toBeTruthy();

    await page.goto(`/uz/verify/${code}`);
    await expect(page.getByText(uz.Certificate.valid, { exact: true })).toBeVisible();
    // The header also shows the signed-in name; the certificate's own row is a <dd>.
    await expect(page.locator("dd", { hasText: USERS.studentA.name })).toBeVisible();

    const pdf = await request.get(`/api/certificates/${code}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("failing issues nothing", async ({ page }) => {
    const userId = await seedExam();
    await login(page, USERS.studentA.email, PASSWORD);
    await sitExam(page, WRONG);

    await expect(page.getByText(uz.Exam.failed, { exact: true })).toBeVisible();
    expect(await certificateFor(userId)).toBeUndefined();
  });

  test("an unknown verification code is rejected", async ({ page, request }) => {
    await page.goto("/uz/verify/NOPE-0000");
    await expect(page.getByText(uz.Certificate.notFound, { exact: true })).toBeVisible();
    expect((await request.get("/api/certificates/NOPE-0000/pdf")).status()).toBe(404);
  });
});
