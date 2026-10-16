import { expect, test, type Page } from "@playwright/test";
import uz from "../../messages/uz.json";
import { IDS, PASSWORD, USERS, seedLessonVideo, testSql, wipeLessonVideos } from "./db";
import { LESSON1_URL, login } from "./helpers";

/**
 * The lesson player against a stand-in for Bunny's embed (CI has no Bunny
 * account). The stand-in speaks the same player.js postMessage protocol —
 * ready, addEventListener, timeupdate, pause, play, setCurrentTime — honours
 * the `t` start parameter, runs at 4× speed so a test waits seconds rather
 * than minutes, and has a fullscreen button like Bunny's.
 *
 * Covers resume (the playhead is saved as the student watches and when they
 * leave, and the next visit starts there) and in-video questions over a
 * fullscreen video (the question shows without leaving fullscreen).
 */

const P = uz.Player;

const FAKE_PLAYER = `<!doctype html>
<html><body style="margin:0;background:#123;color:#fff;font:14px sans-serif">
<button id="fs">Fullscreen</button> <span id="time">0</span>
<script>
  const duration = 600;
  const RATE = 4;
  let time = Number(new URL(location.href).searchParams.get("t") || 0);
  let playing = true;
  const listeners = new Set();
  const show = () => { document.getElementById("time").textContent = String(time); };
  const emit = (event, value) =>
    parent.postMessage(JSON.stringify({ context: "player.js", event, value }), "*");
  addEventListener("message", (e) => {
    let d = e.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
    if (!d || d.context !== "player.js") return;
    if (d.method === "addEventListener") listeners.add(d.value);
    if (d.method === "play") playing = true;
    if (d.method === "pause") { playing = false; if (listeners.has("pause")) emit("pause"); }
    if (d.method === "setCurrentTime") { time = d.value; show(); }
  });
  document.getElementById("fs").onclick = () => document.documentElement.requestFullscreen();
  show();
  setInterval(() => {
    if (!playing) return;
    time = Math.min(duration, time + 0.25 * RATE);
    show();
    if (listeners.has("timeupdate")) emit("timeupdate", { seconds: time, duration });
  }, 250);
  emit("ready");
</script></body></html>`;

async function fakeBunny(page: Page) {
  await page.route("https://iframe.mediadelivery.net/embed/**", (route) =>
    route.fulfill({ contentType: "text/html", body: FAKE_PLAYER }),
  );
}

function player(page: Page) {
  return page.frameLocator("iframe[data-lesson-video]");
}

async function playerTime(page: Page): Promise<number> {
  return Number(await player(page).locator("#time").textContent());
}

async function savedPosition() {
  const sql = testSql();
  const [row] = await sql<{ last_position_seconds: number; last_video_id: string | null }[]>`
    select last_position_seconds, last_video_id from lesson_progress
    where lesson_id = ${IDS.lesson1}
      and user_id = (select id from users where email = ${USERS.studentA.email})`;
  await sql.end();
  return row ?? null;
}

let partId = "";

test.describe.serial("lesson video player", () => {
  test.beforeAll(async () => {
    const sql = testSql();
    await sql`delete from video_questions`;
    await wipeLessonVideos(sql);
    partId = await seedLessonVideo(sql, IDS.lesson1, { duration: 600 });
    // Lesson 1 stays completed for student A (other specs rely on it); only
    // the saved playhead starts empty.
    await sql`
      insert into lesson_progress (user_id, lesson_id, completed)
      select id, ${IDS.lesson1}, true from users where email = ${USERS.studentA.email}
      on conflict (user_id, lesson_id) do update
        set completed = true, last_position_seconds = 0, last_video_id = null`;
    await sql.end();
  });

  test.afterAll(async () => {
    const sql = testSql();
    await sql`delete from video_questions`;
    await wipeLessonVideos(sql);
    await sql`update lesson_progress set last_position_seconds = 0 where lesson_id = ${IDS.lesson1}`;
    await sql.end();
  });

  test("(1) the playhead is saved, and the next visit resumes from it", async ({ page }) => {
    await login(page, USERS.studentA.email, PASSWORD);
    await fakeBunny(page);
    await page.goto(LESSON1_URL);

    // First visit: from the beginning, and no "picking up" line.
    await expect(page.getByRole("button", { name: P.startOver })).toHaveCount(0);

    // Saved every few seconds of playback, against this part.
    await expect.poll(async () => (await savedPosition())?.last_position_seconds ?? 0).toBeGreaterThanOrEqual(10);
    expect((await savedPosition())?.last_video_id).toBe(partId);

    // Leaving the page reports exactly where the student was.
    await expect.poll(() => playerTime(page)).toBeGreaterThanOrEqual(25);
    const leftAt = Math.floor(await playerTime(page));
    await page.goto("/uz/dashboard");
    await expect
      .poll(async () => (await savedPosition())?.last_position_seconds ?? 0)
      .toBeGreaterThanOrEqual(leftAt);

    // Coming back starts there.
    const saved = (await savedPosition())!.last_position_seconds;
    await page.goto(LESSON1_URL);
    const src = await page.locator("iframe[data-lesson-video]").getAttribute("src");
    const url = new URL(src!);
    expect(url.searchParams.get("t")).toBe(String(saved));
    expect(url.searchParams.get("rememberPosition")).toBe("false");
    expect(await playerTime(page)).toBeGreaterThanOrEqual(saved);
    const m = Math.floor(saved / 60);
    const s = String(saved % 60).padStart(2, "0");
    await expect(page.getByText(P.resumedFrom.replace("{time}", `${m}:${s}`))).toBeVisible();

    // "Start over" goes back to the beginning.
    await page.getByRole("button", { name: P.startOver }).click();
    await expect(page.getByRole("button", { name: P.startOver })).toHaveCount(0);
    await expect.poll(() => playerTime(page)).toBeLessThan(saved);
  });

  test("(2) a question over a fullscreen video keeps it fullscreen", async ({ page }) => {
    const sql = testSql();
    await sql`
      insert into video_questions (lesson_id, video_id, timestamp_seconds, prompt, options, correct_index)
      values (${IDS.lesson1}, ${partId}, 16, ${sql.json({ uz: "To'liq ekrandagi savol" })},
        ${sql.json([{ uz: "Ha" }, { uz: "Yo'q" }])}, 0)`;
    await sql`
      update lesson_progress set last_position_seconds = 0
      where lesson_id = ${IDS.lesson1}
        and user_id = (select id from users where email = ${USERS.studentA.email})`;
    await sql.end();

    await login(page, USERS.studentA.email, PASSWORD);
    await fakeBunny(page);
    await page.goto(LESSON1_URL);

    // The student goes fullscreen with the player's own button.
    await player(page).locator("#fs").click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName ?? null)).toBe("IFRAME");

    // The question pops, the video pauses, and fullscreen stays.
    const question = page.getByRole("dialog", { name: P.vqLabel });
    await expect(question).toBeVisible();
    await expect(question).toContainText("To'liq ekrandagi savol");
    expect(await page.evaluate(() => document.fullscreenElement?.tagName ?? null)).toBe("IFRAME");
    const pausedAt = await playerTime(page);
    await page.waitForTimeout(600);
    expect(await playerTime(page)).toBe(pausedAt);

    // It is painted above the fullscreen video, not hidden behind it.
    const box = (await question.getByText("To'liq ekrandagi savol").boundingBox())!;
    const onTop = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("dialog") != null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(onTop).toBe(true);

    // Answering and continuing: still fullscreen, and the video plays on.
    await question.getByRole("button", { name: "Ha" }).click();
    await question.getByRole("button", { name: P.vqCheck }).click();
    await expect(question).toContainText(P.vqCorrect);
    await question.getByRole("button", { name: P.vqContinue }).click();
    await expect(question).toHaveCount(0);
    expect(await page.evaluate(() => document.fullscreenElement?.tagName ?? null)).toBe("IFRAME");
    await expect.poll(() => playerTime(page)).toBeGreaterThan(pausedAt);
  });
});
