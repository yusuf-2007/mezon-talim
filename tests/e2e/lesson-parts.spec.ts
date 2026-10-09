import { expect, test, type Locator, type Page } from "@playwright/test";
import uz from "../../messages/uz.json";
import { IDS, PASSWORD, USERS, seedLessonVideo, testSql, wipeLessonVideos } from "./db";
import { LESSON1_URL, login } from "./helpers";

/**
 * A long lesson split into video parts: one lesson, several videos.
 *
 * Covers authoring (add parts in the lesson editor; saving again keeps each
 * part's id, so what is pinned to it survives), the student's part switcher,
 * completion waiting until every part has been opened (server-checked), notes
 * pinned to a part, and in-video questions written for a specific part.
 * The Bunny GUIDs are fake — CI has no Bunny account — so the player shows its
 * dev embed; nothing here depends on the video actually playing.
 */

const S = uz.Studio;
const P = uz.Player;
const EDITOR = `/uz/admin/courses/${IDS.course}`;
const GUID_1 = "11111111-e2e0-4000-8000-000000000001";
const GUID_2 = "22222222-e2e0-4000-8000-000000000002";
const PART_2_TITLE = "Amaliyot";

type PartRow = { id: string; order_index: number; bunny_video_id: string; duration_seconds: number | null; title: { uz: string } | null };

async function partsOf(lessonId: string): Promise<PartRow[]> {
  const sql = testSql();
  const rows = await sql<PartRow[]>`
    select id, order_index, bunny_video_id, duration_seconds, title
    from lesson_videos where lesson_id = ${lessonId} order by order_index`;
  await sql.end();
  return rows;
}

async function progressOf(lessonId: string) {
  const sql = testSql();
  const [u] = await sql`select id from users where email = ${USERS.studentA.email}`;
  const [row] = await sql<{ completed: boolean; opened_video_ids: string[]; last_video_id: string | null }[]>`
    select completed, opened_video_ids, last_video_id from lesson_progress
    where user_id = ${u.id} and lesson_id = ${lessonId}`;
  await sql.end();
  return row ?? null;
}

function lessonRow(page: Page, title: string): Locator {
  return page.locator("div.rounded-lg", { has: page.getByText(title, { exact: true }) }).first();
}

async function openEditor(page: Page): Promise<Locator> {
  await page.goto(EDITOR);
  const row = lessonRow(page, "Birinchi dars");
  await row.getByRole("button", { name: S.editLesson }).click();
  const field = row.getByTestId("lesson-videos-field");
  await expect(field).toBeVisible();
  return row;
}

test.describe.serial("lesson video parts", () => {
  test.beforeAll(async () => {
    const sql = testSql();
    await wipeLessonVideos(sql);
    await sql`delete from video_questions`;
    await sql`delete from notes`;
    // Student A starts the lesson fresh: nothing opened, not completed.
    await sql`
      delete from lesson_progress
      where lesson_id = ${IDS.lesson1}
        and user_id = (select id from users where email = ${USERS.studentA.email})`;
    await sql.end();
  });

  test.afterAll(async () => {
    const sql = testSql();
    await sql`delete from video_questions`;
    await sql`delete from notes`;
    await wipeLessonVideos(sql);
    // Other specs expect lesson 1 completed for student A (lesson 2 unlocked).
    await sql`
      insert into lesson_progress (user_id, lesson_id, completed)
      select id, ${IDS.lesson1}, true from users where email = ${USERS.studentA.email}
      on conflict (user_id, lesson_id) do update set completed = true`;
    await sql.end();
  });

  test("(1) an editor splits a lesson into two parts", async ({ page }) => {
    await login(page, USERS.admin.email, PASSWORD);
    const row = await openEditor(page);
    const field = row.getByTestId("lesson-videos-field");

    // One part to begin with: it looks like the old single video field.
    await expect(field.getByTestId("lesson-video-part")).toHaveCount(1);
    await field.getByLabel(`${S.bunnyVideoId} · 1-qism`).fill(GUID_1);
    await field.getByLabel(`${S.durationSeconds} · 1-qism`).fill("600");

    await field.getByRole("button", { name: S.videosAdd }).click();
    const parts = field.getByTestId("lesson-video-part");
    await expect(parts).toHaveCount(2);
    const part2 = parts.nth(1);
    await part2.getByLabel(`${S.bunnyVideoId} · 2-qism`).fill(GUID_2);
    await part2.getByLabel(`${S.durationSeconds} · 2-qism`).fill("900");
    await part2.getByLabel(`${S.partTitleUz} · 2-qism`).fill(PART_2_TITLE);

    await row.getByRole("button", { name: S.save, exact: true }).click();
    await expect.poll(async () => (await partsOf(IDS.lesson1)).length).toBe(2);

    const saved = await partsOf(IDS.lesson1);
    expect(saved.map((p) => p.bunny_video_id)).toEqual([GUID_1, GUID_2]);
    expect(saved.map((p) => p.duration_seconds)).toEqual([600, 900]);
    expect(saved[0].title).toBeNull();
    expect(saved[1].title?.uz).toBe(PART_2_TITLE);

    const sql = testSql();
    const [lesson] = await sql`select duration_seconds from lessons where id = ${IDS.lesson1}`;
    await sql.end();
    expect(lesson.duration_seconds).toBe(1500);

    await page.reload();
    await expect(lessonRow(page, "Birinchi dars").getByTestId("lesson-parts-badge")).toContainText("2 qism");
  });

  test("(2) saving again keeps each part's id (what is pinned to it survives)", async ({ page }) => {
    const before = await partsOf(IDS.lesson1);
    await login(page, USERS.admin.email, PASSWORD);
    const row = await openEditor(page);
    const parts = row.getByTestId("lesson-videos-field").getByTestId("lesson-video-part");
    await expect(parts).toHaveCount(2);
    await parts.nth(0).getByLabel(`${S.partTitleUz} · 1-qism`).fill("Kirish");
    await row.getByRole("button", { name: S.save, exact: true }).click();
    await expect.poll(async () => (await partsOf(IDS.lesson1))[0]?.title?.uz ?? null).toBe("Kirish");
    const after = await partsOf(IDS.lesson1);
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
  });

  test("(3) an in-video question is written for one part", async ({ page }) => {
    page.on("dialog", (d) => void d.accept());
    await login(page, USERS.admin.email, PASSWORD);
    await page.goto(EDITOR);
    const row = lessonRow(page, "Birinchi dars");
    await row.getByRole("button", { name: S.vqButton }).click();
    await page.getByRole("button", { name: `+ ${S.vqAdd}` }).click();

    const [, part2] = await partsOf(IDS.lesson1);
    await page.getByLabel(S.vqPart).selectOption(part2.id);
    await page.locator("input[name=timestamp]").pressSequentially("0130");
    await page.fill("input[name=promptUz]", "Ikkinchi qism savoli");
    await page.fill("input[name=option0Uz]", "Ha");
    await page.fill("input[name=option1Uz]", "Yo'q");
    await page.getByRole("button", { name: S.vqAdd, exact: true }).click();

    const created = page.locator("li", { hasText: "Ikkinchi qism savoli" }).last();
    await expect(created).toBeVisible();
    await expect(created).toContainText(PART_2_TITLE);

    const sql = testSql();
    const [q] = await sql`select video_id from video_questions where lesson_id = ${IDS.lesson1}`;
    await sql.end();
    expect(q.video_id).toBe(part2.id);
  });

  test("(4) the student switches parts, and completion waits for every part", async ({ page }) => {
    const [part1, part2] = await partsOf(IDS.lesson1);
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto(LESSON1_URL);

    const nav = page.getByTestId("lesson-parts");
    await expect(nav.getByRole("link", { name: /Kirish/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: new RegExp(PART_2_TITLE) })).toBeVisible();
    await expect(page.getByText("2 qism").first()).toBeVisible();

    // Part 1 only: "Mark complete" is held back and points at part 2.
    const blocked = page.getByRole("link", { name: P.partsLeftToComplete.replace("{opened}", "1").replace("{total}", "2") });
    await expect(blocked).toBeVisible();
    await expect(page.getByRole("button", { name: P.markComplete })).toHaveCount(0);
    await expect.poll(async () => (await progressOf(IDS.lesson1))?.opened_video_ids ?? []).toEqual([part1.id]);

    // Next part → part 2 is now open too, and the lesson can be completed.
    await nav.getByRole("link", { name: P.nextPart }).click();
    await expect(page).toHaveURL(/\?part=2$/);
    await expect(nav.getByRole("link", { name: new RegExp(PART_2_TITLE) })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: P.nextPart })).toHaveCount(0);

    // The course rail lists the parts under the lesson, the one on screen marked.
    const railParts = page.getByTestId("rail-lesson-parts");
    await expect(railParts.getByRole("link")).toHaveCount(2);
    await expect(railParts.getByRole("link", { name: new RegExp(PART_2_TITLE) })).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: P.markComplete }).click();
    await expect(page.getByText(`✓ ${P.completed}`)).toBeVisible();

    const progress = await progressOf(IDS.lesson1);
    expect(progress?.completed).toBe(true);
    expect([...(progress?.opened_video_ids ?? [])].sort()).toEqual([part1.id, part2.id].sort());
    expect(progress?.last_video_id).toBe(part2.id);

    // Coming back without ?part resumes on the part the student was last on.
    await page.goto(LESSON1_URL);
    await expect(nav.getByRole("link", { name: new RegExp(PART_2_TITLE) })).toHaveAttribute("aria-current", "page");
  });

  test("(5) with a part still unopened, Mark complete is held back", async ({ page }) => {
    const [part1] = await partsOf(IDS.lesson1);
    const sql = testSql();
    await sql`
      update lesson_progress set completed = false, opened_video_ids = ${sql.json([part1.id])}, last_video_id = ${part1.id}
      where lesson_id = ${IDS.lesson1} and user_id = (select id from users where email = ${USERS.studentA.email})`;
    await sql.end();

    // Back on part 1 with part 2 unopened: the button is not offered.
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto(`${LESSON1_URL}?part=1`);
    await expect(page.getByRole("button", { name: P.markComplete })).toHaveCount(0);
    expect((await progressOf(IDS.lesson1))?.completed).toBe(false);
  });

  test("(6) a timestamped note is pinned to the part on screen", async ({ page }) => {
    const [, part2] = await partsOf(IDS.lesson1);
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto(`${LESSON1_URL}?part=2`);
    await page.fill("textarea[name=body]", "Ikkinchi qismdagi eslatma");
    await page.locator("input[name=timestamp]").pressSequentially("0105");
    await page.getByRole("button", { name: P.addNote }).click();

    const note = page.locator("li", { hasText: "Ikkinchi qismdagi eslatma" });
    await expect(note).toContainText(PART_2_TITLE);
    await expect(note).toContainText("1:05");

    const sql = testSql();
    const [n] = await sql`select video_id from notes where body = 'Ikkinchi qismdagi eslatma'`;
    await sql.end();
    expect(n.video_id).toBe(part2.id);
  });

  test("(7) a single-part lesson is unchanged: no part switcher", async ({ page }) => {
    const sql = testSql();
    await wipeLessonVideos(sql);
    await seedLessonVideo(sql, IDS.lesson1);
    await sql.end();
    await login(page, USERS.studentA.email, PASSWORD);
    await page.goto(LESSON1_URL);
    await expect(page.getByTestId("lesson-parts")).toHaveCount(0);
    await expect(page.getByRole("button", { name: P.markComplete })).toBeVisible();
  });
});
