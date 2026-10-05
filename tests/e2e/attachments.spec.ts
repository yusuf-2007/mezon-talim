import {
  expect,
  request as playwrightRequest,
  test,
  type Locator,
  type Page,
} from "@playwright/test";
import { PDFDocument, StandardFonts, grayscale } from "pdf-lib";
import sharp from "sharp";
import { THUMB_WIDTH } from "../../lib/attachments/limits";
import uz from "../../messages/uz.json";
import { IDS, PASSWORD, USERS, testSql, wipeAttachments } from "./db";
import { LESSON1_URL, login } from "./helpers";
import {
  ATTACHMENTS_PREFIX,
  STORAGE_SKIP_REASON,
  e2eStorage,
  ensureBucket,
  getObject,
  listKeys,
  putObject,
  wipePrefix,
  type E2EStorage,
} from "./storage";

/**
 * Lesson attachments, end to end: a teacher uploads a PDF or an image in the
 * lesson form (the browser renders the slides and posts them straight to
 * MinIO), and students see the slides under the video, either view-only (the
 * server watermarks every slide and the page shields them) or downloadable.
 *
 * The tests run in order and share one attachment on lesson 1:
 * upload → view-only viewer → shield → refusals → download on → delete → a
 * second, image attachment through the create form → a module delete that has
 * to take its stored files with it. Everything they add is removed afterwards
 * (and by global-setup), because slides on lesson 1, an extra lesson in the
 * module or an extra module would change what the other specs see.
 */

// e2eStorage() throws when it refuses the configured MinIO (not localhost, or
// not a disposable bucket). Thrown at load time, that would abort the whole
// Playwright run, every other spec included; skip just this one, saying why.
let storage: E2EStorage | null = null;
let storageRefusal: string | undefined;
try {
  storage = e2eStorage();
} catch (err) {
  storageRefusal = (err as Error).message;
}
test.skip(!storage, storageRefusal ?? STORAGE_SKIP_REASON);
// Against a cold `next dev`, these tests are the first to compile several heavy
// routes (the course editor, its server actions, the sharp + fontkit slide
// route, the lesson page), on top of the upload itself. The default 90s budget
// was not enough on a cold cache (up to ~150s per test on a loaded machine);
// production builds finish each test in seconds.
test.describe.configure({ mode: "serial", timeout: 240_000 });

const S = uz.Studio;
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k]));

const ADMIN_EDITOR = `/uz/admin/courses/${IDS.course}`;
const STUDIO_EDITOR = `/uz/studio/courses/${IDS.course}`;
const PDF_NAME = "e2e-ikki-slayd.pdf";
/** Picked without an extension; stored (and downloaded) with the type's. */
const PNG_PICKED_NAME = "e2e-sxema";
const PNG_NAME = "e2e-sxema.png";
const NEW_LESSON_TITLE = "E2E materiallar darsi";

const pageUrl = (id: string, n: number, thumb = false) =>
  `/api/attachments/${id}/pages/${n}${thumb ? "?size=thumb" : ""}`;
const downloadUrl = (id: string) => `/api/attachments/${id}/download`;

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Two 960×540 pt pages with big "SLIDE n" text: rendered at 1920×1080. */
async function twoPagePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const n of [1, 2]) {
    const page = pdf.addPage([960, 540]);
    page.drawText(`SLIDE ${n}`, { x: 240, y: 230, size: 120, font, color: grayscale(0.15) });
  }
  return Buffer.from(await pdf.save());
}

async function diagramPng(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="#f3e6c4"/>
    <circle cx="600" cy="400" r="260" fill="#c9a24a"/>
    <rect x="100" y="100" width="300" height="200" fill="#0f2747"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Share of pixels that differ by more than a few levels between two encodings
 * of the same slide, compared at the first one's size.
 */
async function changedShare(a: Buffer, b: Buffer): Promise<number> {
  const A = await sharp(a)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const B = await sharp(b)
    .flatten({ background: "#ffffff" })
    .resize(A.info.width, A.info.height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  let changed = 0;
  for (let i = 0; i < A.data.length; i += 3) {
    const d = Math.max(
      Math.abs(A.data[i] - B[i]),
      Math.abs(A.data[i + 1] - B[i + 1]),
      Math.abs(A.data[i + 2] - B[i + 2]),
    );
    if (d > 12) changed++;
  }
  return changed / (A.data.length / 3);
}

// ── Shared state (the tests run in order) ───────────────────────────────────

type Who = keyof typeof USERS;
const sessions = new Map<Who, Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>>();
let pdfBytes: Buffer;
let pngBytes: Buffer;
let deck: { id: string; prefix: string; slideExt: string } | null = null;
let viewOnlyThumb: Buffer | null = null;

/** Sign in once per user, then reuse the session cookies in later tests. */
async function signIn(page: Page, who: Who) {
  const cached = sessions.get(who);
  if (cached) {
    await page.context().addCookies(cached);
    return;
  }
  await login(page, USERS[who].email, PASSWORD);
  sessions.set(who, await page.context().cookies());
}

function requireDeck() {
  if (!deck) throw new Error("No attachment yet: the upload test must pass first.");
  return deck;
}

function store(): E2EStorage {
  if (!storage) throw new Error(STORAGE_SKIP_REASON);
  return storage;
}

type AttachmentDbRow = {
  id: string;
  lesson_id: string;
  status: string;
  kind: string;
  page_count: number;
  pages: { w: number; h: number }[];
  allow_download: boolean;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  slide_mime: string;
  storage_prefix: string;
  order_index: number;
};

async function attachmentsOf(lessonId: string): Promise<AttachmentDbRow[]> {
  const sql = testSql();
  const rows = await sql<AttachmentDbRow[]>`
    select id, lesson_id, status, kind, page_count, pages, allow_download, file_name,
           mime_type, size_bytes, slide_mime, storage_prefix, order_index
    from lesson_attachments where lesson_id = ${lessonId} order by order_index`;
  await sql.end();
  return rows;
}

async function resetAttachments() {
  const sql = testSql();
  await wipeAttachments(sql);
  await sql.end();
  await wipePrefix(store(), ATTACHMENTS_PREFIX);
}

/** A LessonRow in the course editor, by its exact title. */
function lessonRow(page: Page, title: string): Locator {
  return page.locator("div.rounded-lg", { has: page.getByText(title, { exact: true }) }).first();
}

/** Open a lesson's edit form; returns its attachments section. */
async function openLessonEditor(page: Page, title: string): Promise<Locator> {
  await page.goto(ADMIN_EDITOR);
  const row = lessonRow(page, title);
  await row.getByRole("button", { name: S.editLesson }).click();
  const section = row.getByTestId("lesson-attachments");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("attachments-input")).toBeAttached();
  return section;
}

const stageCanvas = (page: Page) =>
  page.getByTestId("slides-stage").getByTestId("slides-canvas");

/** How many of the viewer's canvases hold any painted pixel. */
function paintedCanvases(page: Page): Promise<number> {
  return page
    .locator("[data-testid=lesson-slides] canvas")
    .evaluateAll((canvases) =>
      (canvases as HTMLCanvasElement[]).filter((c) => {
        const ctx = c.getContext("2d");
        if (!ctx || c.width === 0 || c.height === 0) return false;
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
        return false;
      }).length,
    );
}

test.beforeAll(async () => {
  await ensureBucket(store());
  await resetAttachments();
  pdfBytes = await twoPagePdf();
  pngBytes = await diagramPng();
});

test.afterAll(async () => {
  if (storage) await resetAttachments();
});

// ── (1) Upload in the edit form ─────────────────────────────────────────────

test("(1) admin uploads a 2-page PDF in the lesson edit form: ready, 2 slides, download off", async ({
  page,
}) => {
  await signIn(page, "admin");
  const section = await openLessonEditor(page, "Birinchi dars");

  await section.getByTestId("attachments-input").setInputFiles({
    name: PDF_NAME,
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });

  // Rendered in the browser, posted straight to MinIO, then finalized.
  const ready = section.locator("[data-testid=attachment-row][data-status=ready]");
  await expect(ready).toHaveCount(1, { timeout: 60_000 });
  await expect(section.getByTestId("attachment-upload")).toHaveCount(0);
  await expect(ready.getByTestId("attachment-meta")).toContainText(
    fill(S.attachmentSlides, { count: 2 }),
  );
  await expect(ready.getByTestId("attachment-allow-download")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(ready.getByTestId("attachment-title-uz")).toHaveValue("e2e-ikki-slayd");
  // The Studio thumbnail comes through the slide route (instructor access).
  // Generous: on a cold dev server this is the route's first compile.
  await expect
    .poll(() => ready.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth), {
      timeout: 90_000,
    })
    .toBeGreaterThan(0);

  const id = await ready.getAttribute("data-attachment-id");
  expect(id).toBeTruthy();

  const [row] = await attachmentsOf(IDS.lesson1);
  expect(row).toMatchObject({
    id,
    status: "ready",
    kind: "pdf",
    page_count: 2,
    allow_download: false,
    file_name: PDF_NAME,
    mime_type: "application/pdf",
    size_bytes: pdfBytes.length,
    storage_prefix: `lesson-attachments/${IDS.lesson1}/${id}`,
  });
  expect(row.pages).toEqual([
    { w: 1920, h: 1080 },
    { w: 1920, h: 1080 },
  ]);
  const slideExt = row.slide_mime === "image/jpeg" ? "jpg" : "webp";
  deck = { id: id!, prefix: row.storage_prefix, slideExt };

  // Server-generated keys: the private original plus one object per slide.
  const keys = await listKeys(store(), `${row.storage_prefix}/`);
  expect(keys.sort()).toEqual(
    [
      `${row.storage_prefix}/original`,
      `${row.storage_prefix}/p/1.${slideExt}`,
      `${row.storage_prefix}/p/2.${slideExt}`,
    ].sort(),
  );
  expect(await getObject(store(), `${row.storage_prefix}/original`)).toEqual(pdfBytes);

  // Closing the editor leaves the attachment count on the lesson row.
  const lesson = lessonRow(page, "Birinchi dars");
  await lesson.getByRole("button", { name: S.cancel }).first().click();
  await expect(lesson.getByTestId("lesson-attachments-badge")).toContainText("1");
});

// ── (2) View-only viewer + the slide route ──────────────────────────────────

test("(2) an enrolled student gets a view-only viewer with watermarked, never-downloadable slides", async ({
  page,
}) => {
  const { id, prefix, slideExt } = requireDeck();
  await signIn(page, "studentA");
  await page.goto(LESSON1_URL);

  const viewer = page.getByTestId("lesson-slides");
  await expect(viewer).toHaveAttribute("data-deck-id", id);
  await expect(viewer).toHaveAttribute("data-view-only", "true");
  await expect(page.getByTestId("slides-title")).toHaveText("e2e-ikki-slayd");
  await expect(page.getByTestId("slides-counter")).toHaveText("1 / 2");
  await expect(page.getByTestId("slides-thumb")).toHaveCount(2);
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect(page.getByTestId("slides-view-only-note")).toBeVisible();

  // No download, and no <img> a student could save.
  await expect(page.getByTestId("slides-download")).toHaveCount(0);
  await expect(viewer.locator("img")).toHaveCount(0);

  await page.getByTestId("slides-next").click();
  await expect(page.getByTestId("slides-counter")).toHaveText("2 / 2");
  await expect(stageCanvas(page)).toHaveAttribute("data-page", "2");
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready", { timeout: 30_000 });

  // The page never hands the client a storage key or a presigned URL.
  const html = await page.content();
  expect(html).not.toContain(prefix);
  expect(html).not.toContain(ATTACHMENTS_PREFIX);
  expect(html).not.toContain("X-Amz-");

  // The slide route, with the student's session.
  const res = await page.request.get(pageUrl(id, 1));
  expect(res.status()).toBe(200);
  const headers = res.headers();
  expect(headers["content-type"]).toBe("image/webp");
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["cache-control"]).toContain("private");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["content-disposition"]).toBe("inline");

  // Watermarked: not the stored slide, and visibly changed — far beyond what
  // re-encoding the same slide does.
  const served = await res.body();
  const raw = await getObject(store(), `${prefix}/p/1.${slideExt}`);
  expect(raw).not.toBeNull();
  expect(served.equals(raw!)).toBe(false);
  const meta = await sharp(served).metadata();
  expect([meta.width, meta.height]).toEqual([1920, 1080]);
  const reencoded = await sharp(raw!).webp({ quality: 82 }).toBuffer();
  const noise = await changedShare(raw!, reencoded);
  const watermark = await changedShare(raw!, served);
  test.info().annotations.push({
    type: "watermark",
    description: `${(watermark * 100).toFixed(2)}% of pixels changed (re-encoding alone: ${(noise * 100).toFixed(2)}%)`,
  });
  expect(watermark).toBeGreaterThan(Math.max(0.02, noise * 5));

  // Thumbnails are watermarked too.
  const thumb = await page.request.get(pageUrl(id, 1, true));
  expect(thumb.status()).toBe(200);
  expect(thumb.headers()["content-type"]).toBe("image/webp");
  viewOnlyThumb = await thumb.body();
  expect((await sharp(viewOnlyThumb).metadata()).width).toBe(360);

  // Pages out of range, and the original, are refused.
  expect((await page.request.get(pageUrl(id, 3))).status()).toBe(404);
  expect((await page.request.get(pageUrl(id, 0))).status()).toBe(404);
  expect((await page.request.get(`/api/attachments/${id}/pages/abc`)).status()).toBe(404);
  const download = await page.request.get(downloadUrl(id), { maxRedirects: 0 });
  expect(download.status()).toBe(403);
});

// ── (7) Shield ──────────────────────────────────────────────────────────────

test("(7) the view-only viewer goes gray on window blur and recovers on focus", async ({
  page,
}) => {
  requireDeck();
  await signIn(page, "studentA");
  await page.goto(LESSON1_URL);
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect.poll(() => paintedCanvases(page)).toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByTestId("slides-shield")).toBeVisible();
  await expect(page.getByTestId("slides-stage")).toHaveAttribute("data-state", "shielded");
  await expect(page.getByTestId("slides-shield")).toContainText(uz.Player.slidesProtected);
  // Cleared, not just covered: no slide pixels left on any canvas.
  await expect.poll(() => paintedCanvases(page)).toBe(0);

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("slides-shield")).toHaveCount(0);
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(() => paintedCanvases(page)).toBeGreaterThan(0);

  // Ctrl+P is intercepted while a view-only deck is on the page…
  const printPrevented = await page.evaluate(() => {
    const e = new KeyboardEvent("keydown", {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(printPrevented).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("slides-shield")).toHaveCount(0);

  // …and printing anyway shows a notice instead of the slides.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("lesson-slides")).toBeHidden();
  await expect(page.getByTestId("slides-print-disabled")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByTestId("slides-print-disabled")).toBeHidden();
});

test("(7b) the shield ignores focus going into the lesson video, clears a stuck screenshot combo on the next pointer event, and starts shielded in an unfocused window", async ({
  page,
}) => {
  requireDeck();
  await signIn(page, "studentA");
  await page.goto(LESSON1_URL);
  const stage = page.getByTestId("slides-stage");
  const shield = page.getByTestId("slides-shield");
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready", { timeout: 30_000 });

  // The e2e lesson has no Bunny video; stand in frames like VideoEmbed's. Real
  // focus moves into them, so the window gets a real blur.
  await page.evaluate(() => {
    const w = window as unknown as { e2eBlurs: number };
    w.e2eBlurs = 0;
    window.addEventListener("blur", () => w.e2eBlurs++);
    for (const [id, video] of [
      ["e2e-video", true],
      ["e2e-other-frame", false],
    ] as const) {
      const frame = document.createElement("iframe");
      frame.id = id;
      if (video) frame.setAttribute("data-lesson-video", "");
      frame.srcdoc = "<button id=b>play</button>";
      document.body.prepend(frame);
    }
  });
  const blurs = () => page.evaluate(() => (window as unknown as { e2eBlurs: number }).e2eBlurs);

  // Clicking into the lesson video: the window blurs, the slides stay.
  await page.frameLocator("#e2e-video").locator("#b").click();
  await expect.poll(blurs).toBe(1);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("e2e-video");
  await page.waitForTimeout(800); // past the release delay, had it shielded
  await expect(shield).toHaveCount(0);
  await expect(stage).toHaveAttribute("data-state", "ready");
  await expect.poll(() => paintedCanvases(page)).toBeGreaterThan(0);

  // Back to the page, then into any other frame: that is still a blur.
  await stage.click();
  await page.frameLocator("#e2e-other-frame").locator("#b").click();
  await expect.poll(blurs).toBe(2);
  await expect(shield).toBeVisible();
  await stage.click();
  await expect(shield).toHaveCount(0);

  // Cmd/Ctrl+Shift goes down, and the capture tool swallows the keyups.
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", shiftKey: true, ctrlKey: true }),
    ),
  );
  await expect(shield).toBeVisible();
  await page.waitForTimeout(800);
  await expect(shield).toBeVisible(); // no keyup: still up
  // The first pointer event afterwards carries the real (released) modifiers.
  await page.mouse.move(40, 40);
  await page.mouse.move(60, 60);
  await expect(shield).toHaveCount(0);
  await expect(stage).toHaveAttribute("data-state", "ready");

  // A window that is already unfocused when the viewer mounts gets no blur
  // event; it must start shielded, and coming back lifts it.
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, "hasFocus", { value: () => false, configurable: true });
  });
  await page.goto(LESSON1_URL);
  await expect(shield).toBeVisible({ timeout: 30_000 });
  await expect(stage).toHaveAttribute("data-state", "shielded");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(shield).toHaveCount(0);
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
});

// ── (4) Refusals ────────────────────────────────────────────────────────────

test("(4) a student who is not enrolled, an anonymous request and a cross-site request are refused", async ({
  page,
  baseURL,
}) => {
  const { id } = requireDeck();

  // Anonymous: no session at all.
  const anon = await playwrightRequest.newContext({ baseURL });
  try {
    expect((await anon.get(pageUrl(id, 1))).status()).toBe(401);
    expect((await anon.get(pageUrl(id, 1, true))).status()).toBe(401);
    expect((await anon.get(downloadUrl(id), { maxRedirects: 0 })).status()).toBe(401);
  } finally {
    await anon.dispose();
  }

  // Signed in, but not enrolled: the lesson is locked for them.
  await signIn(page, "outsider");
  expect((await page.request.get(pageUrl(id, 1))).status()).toBe(403);
  expect((await page.request.get(pageUrl(id, 1, true))).status()).toBe(403);
  expect((await page.request.get(downloadUrl(id), { maxRedirects: 0 })).status()).toBe(403);
  // A locked lesson page does not even reveal that the attachment exists.
  await page.goto(LESSON1_URL);
  await expect(page.getByTestId("lesson-slides")).toHaveCount(0);
  expect(await page.content()).not.toContain(id);

  // Unknown and malformed ids look the same as a missing attachment.
  expect(
    (await page.request.get(pageUrl("00000000-0000-4000-8000-0000000000ff", 1))).status(),
  ).toBe(404);
  expect((await page.request.get(pageUrl("not-a-uuid", 1))).status()).toBe(404);

  // Enrolled, but the request comes from another site (hotlinking).
  await page.context().clearCookies();
  await signIn(page, "studentA");
  for (const site of ["cross-site", "same-site"]) {
    const res = await page.request.get(pageUrl(id, 1), { headers: { "Sec-Fetch-Site": site } });
    expect(res.status(), `Sec-Fetch-Site: ${site}`).toBe(403);
  }
  for (const site of ["same-origin", "none"]) {
    const res = await page.request.get(pageUrl(id, 1), { headers: { "Sec-Fetch-Site": site } });
    expect(res.status(), `Sec-Fetch-Site: ${site}`).toBe(200);
  }
});

test("(4b) a slide whose stored bytes are not what its row declares is refused, never decoded", async ({
  page,
}) => {
  const { id, prefix, slideExt } = requireDeck();
  await signIn(page, "studentA");
  const key = `${prefix}/p/2.${slideExt}`;
  const mime = slideExt === "jpg" ? "image/jpeg" : "image/webp";
  const original = await getObject(store(), key);
  expect(original).not.toBeNull();

  // An upload policy stays valid for a while after finalize, so a slide can be
  // replaced behind the row's back. Neither a real image of the wrong size…
  const blank = sharp({ create: { width: 4096, height: 4096, channels: 3, background: "#fff" } });
  const giant = await (slideExt === "jpg" ? blank.jpeg() : blank.webp()).toBuffer();
  // …nor an SVG stored under the slide's name and type gets through.
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080"/></svg>',
  );
  try {
    for (const bytes of [giant, svg]) {
      await putObject(store(), key, bytes, mime);
      expect((await page.request.get(pageUrl(id, 2))).status()).toBe(503);
      expect((await page.request.get(pageUrl(id, 2, true))).status()).toBe(503);
    }
  } finally {
    await putObject(store(), key, original!, mime);
  }
  expect((await page.request.get(pageUrl(id, 2))).status()).toBe(200);
});

test("(4c) a viewer past the slide budget gets 429 with Retry-After, and the viewer says why", async ({
  page,
}) => {
  const { id } = requireDeck();
  await signIn(page, "studentA");
  const sql = testSql();
  const [student] = await sql<{ id: string }[]>`
    select id from users where email = ${USERS.studentA.email}`;
  const key = `attachments:pages:${student.id}`;
  // Far past any budget, in the current window.
  await sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1000000)
    on conflict (key) do update set window_start = now(), count = 1000000`;
  try {
    const res = await page.request.get(pageUrl(id, 1));
    expect(res.status()).toBe(429);
    expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
    expect(res.headers()["cache-control"]).toContain("no-store");

    await page.goto(LESSON1_URL);
    await expect(page.getByTestId("slides-error")).toContainText(uz.Player.slidesErrorBusy, {
      timeout: 30_000,
    });
  } finally {
    await sql`delete from rate_limits where key = ${key}`;
    await sql.end();
  }
  expect((await page.request.get(pageUrl(id, 1))).status()).toBe(200);
});

// ── (3) Download on ─────────────────────────────────────────────────────────

test("(3a) admin turns 'allow download' on; it saves immediately", async ({ page }) => {
  const { id } = requireDeck();
  await signIn(page, "admin");
  const section = await openLessonEditor(page, "Birinchi dars");

  const row = section.locator(`[data-testid=attachment-row][data-attachment-id="${id}"]`);
  const toggle = row.getByTestId("attachment-allow-download");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(row.getByTestId("attachment-save-state")).toContainText(S.attachmentSaved);

  const [saved] = await attachmentsOf(IDS.lesson1);
  expect(saved.allow_download).toBe(true);

  // The lesson's own Save is independent of its attachments and still works
  // (the editor closes on success; the title is unchanged).
  const lesson = lessonRow(page, "Birinchi dars");
  await lesson.getByRole("button", { name: S.save, exact: true }).click();
  await expect(lesson.getByTestId("lesson-attachments")).toHaveCount(0);
  await expect(lesson.getByTestId("lesson-attachments-badge")).toContainText("1");
});

test("(3b) the student can then download the original, and the slides are no longer shielded", async ({
  page,
}) => {
  const { id, prefix, slideExt } = requireDeck();
  await signIn(page, "studentA");
  await page.goto(LESSON1_URL);

  const viewer = page.getByTestId("lesson-slides");
  await expect(viewer).toHaveAttribute("data-view-only", "false");
  const link = page.getByTestId("slides-download");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", downloadUrl(id));
  await expect(link).toContainText(uz.Player.slidesDownload);
  await expect(page.getByTestId("slides-view-only-note")).toHaveCount(0);
  await expect(stageCanvas(page)).toHaveAttribute("data-state", "ready", { timeout: 30_000 });

  // The route: a short-lived storage redirect that forces a download.
  const redirect = await page.request.get(downloadUrl(id), { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()["cache-control"]).toContain("no-store");
  const location = redirect.headers()["location"];
  expect(location).toContain(store().endpoint);
  const direct = await playwrightRequest.newContext();
  try {
    const original = await direct.get(location);
    expect(original.status()).toBe(200);
    const disposition = original.headers()["content-disposition"];
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(`filename="${PDF_NAME}"`);
    expect(await original.body()).toEqual(pdfBytes);
  } finally {
    await direct.dispose();
  }

  // Clicking the button downloads the file and stays on the lesson.
  const before = page.url();
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe(PDF_NAME);
  expect(page.url()).toBe(before);

  // Downloadable decks are served as stored (no watermark), thumbnails unmarked.
  const stored = await getObject(store(), `${prefix}/p/1.${slideExt}`);
  expect(stored).not.toBeNull();
  const full = await page.request.get(pageUrl(id, 1));
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe(slideExt === "jpg" ? "image/jpeg" : "image/webp");
  expect(full.headers()["cache-control"]).toContain("no-store");
  expect((await full.body()).equals(stored!)).toBe(true);
  const thumb = await page.request.get(pageUrl(id, 1, true));
  expect(thumb.status()).toBe(200);
  expect(thumb.headers()["content-type"]).toBe("image/webp");
  // Byte for byte the plain resize the route does without a watermark (same
  // sharp build on both sides). Comparing with test (2)'s watermarked thumb
  // alone would prove nothing: its burned-in time changes every minute.
  const plainThumb = await sharp(stored!)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  expect((await thumb.body()).equals(plainThumb)).toBe(true);
  expect(viewOnlyThumb).not.toBeNull();
  expect((await thumb.body()).equals(viewOnlyThumb!)).toBe(false);

  // No shield for a downloadable deck.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByTestId("slides-shield")).toHaveCount(0);
  await expect(page.getByTestId("slides-stage")).toHaveAttribute("data-state", "ready");
});

// ── (6) Delete ──────────────────────────────────────────────────────────────

test("(6) admin deletes the attachment: its routes 404 and its objects are gone", async ({
  page,
}) => {
  const { id, prefix } = requireDeck();
  await signIn(page, "admin");
  const section = await openLessonEditor(page, "Birinchi dars");

  page.once("dialog", (d) => void d.accept());
  await section
    .locator(`[data-testid=attachment-row][data-attachment-id="${id}"]`)
    .getByTestId("attachment-delete")
    .click();
  await expect(section.getByTestId("attachment-row")).toHaveCount(0);

  await expect.poll(async () => (await attachmentsOf(IDS.lesson1)).length).toBe(0);
  expect(await listKeys(store(), `${prefix}/`)).toEqual([]);
  expect((await page.request.get(pageUrl(id, 1))).status()).toBe(404);
  expect((await page.request.get(pageUrl(id, 1, true))).status()).toBe(404);
  expect((await page.request.get(downloadUrl(id), { maxRedirects: 0 })).status()).toBe(404);

  await page.goto(LESSON1_URL);
  await expect(page.getByTestId("lesson-slides")).toHaveCount(0);
});

// ── (5) Create mode ─────────────────────────────────────────────────────────

test("(5) a new lesson created with a queued PNG gets a ready attachment after save", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto(STUDIO_EDITOR);
  await page.getByRole("button", { name: `+ ${S.addLesson}` }).click();

  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: S.addLesson, exact: true }) });
  await expect(form).toHaveCount(1);
  await form.locator("input[name=titleUz]").fill(NEW_LESSON_TITLE);

  // Rendered and validated right away, then held until the lesson exists.
  await form.getByTestId("attachments-input").setInputFiles({
    name: PNG_PICKED_NAME,
    mimeType: "image/png",
    buffer: pngBytes,
  });
  const queued = form.getByTestId("attachment-upload");
  await expect(queued).toHaveAttribute("data-phase", "ready", { timeout: 30_000 });
  await expect(queued.getByTestId("attachment-upload-status")).toHaveText(S.attachmentQueued);
  expect(await attachmentsOf(IDS.lesson1)).toHaveLength(0);

  await form.getByRole("button", { name: S.addLesson, exact: true }).click();

  // Created, uploaded, then the form collapses and the new row shows its badge.
  await expect(form).toHaveCount(0, { timeout: 60_000 });
  const row = lessonRow(page, NEW_LESSON_TITLE);
  await expect(row).toBeVisible();
  await expect(row.getByTestId("lesson-attachments-badge")).toContainText("1");

  const sql = testSql();
  const lessons = await sql<{ id: string }[]>`
    select id from lessons
    where module_id = ${IDS.module} and title->>'uz' = ${NEW_LESSON_TITLE} and deleted_at is null`;
  await sql.end();
  expect(lessons).toHaveLength(1);
  const lessonId = lessons[0].id;

  const rows = await attachmentsOf(lessonId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    status: "ready",
    kind: "image",
    page_count: 1,
    allow_download: false,
    file_name: PNG_NAME,
    mime_type: "image/png",
    size_bytes: pngBytes.length,
    order_index: 0,
  });
  expect(rows[0].pages).toEqual([{ w: 1200, h: 800 }]);
  expect(await getObject(store(), `${rows[0].storage_prefix}/original`)).toEqual(pngBytes);

  const slide = await page.request.get(pageUrl(rows[0].id, 1));
  expect(slide.status()).toBe(200);
  expect(slide.headers()["content-type"]).toBe("image/webp");
});

// ── (8) Module delete ───────────────────────────────────────────────────────

const PURGE_MODULE = {
  id: "00000000-0000-4000-8000-0000000000e8",
  title: "E2E oʻchiriladigan modul",
  liveLesson: "00000000-0000-4000-8000-0000000000e9",
  deletedLesson: "00000000-0000-4000-8000-0000000000ea",
  attachment: "00000000-0000-4000-8000-0000000000eb",
};

test("(8) deleting a module removes its lessons' stored files too, soft-deleted lessons included", async ({
  page,
}) => {
  const m = PURGE_MODULE;
  const livePrefix = `lesson-attachments/${m.liveLesson}/`;
  const deletedPrefix = `lesson-attachments/${m.deletedLesson}/`;

  // A module with a live lesson (one ready attachment) and a soft-deleted one
  // whose files were never cleaned up.
  const sql = testSql();
  await sql`
    insert into modules (id, course_id, order_index, title)
    values (${m.id}, ${IDS.course}, 99, ${sql.json({ uz: m.title, ru: m.title, en: m.title })})`;
  await sql`
    insert into lessons (id, module_id, order_index, title, deleted_at) values
      (${m.liveLesson}, ${m.id}, 0, ${sql.json({ uz: "Tirik dars" })}, null),
      (${m.deletedLesson}, ${m.id}, 1, ${sql.json({ uz: "Oʻchirilgan dars" })}, now())`;
  await sql`
    insert into lesson_attachments (id, lesson_id, order_index, title, kind, status, file_name,
      mime_type, size_bytes, page_count, pages, slide_mime, storage_prefix)
    values (${m.attachment}, ${m.liveLesson}, 0, ${sql.json({ uz: "Material" })}, 'image', 'ready',
      ${PNG_NAME}, 'image/png', ${pngBytes.length}, 1, ${sql.json([{ w: 1200, h: 800 }])},
      'image/webp', ${`${livePrefix}${m.attachment}`})`;
  await sql.end();
  await putObject(store(), `${livePrefix}${m.attachment}/original`, pngBytes, "image/png");
  await putObject(
    store(),
    `${livePrefix}${m.attachment}/p/1.webp`,
    await sharp(pngBytes).webp().toBuffer(),
    "image/webp",
  );
  await putObject(store(), `${deletedPrefix}leftover/original`, pngBytes, "image/png");

  // Files of other lessons (test (5)'s) must survive.
  const others = (await listKeys(store(), ATTACHMENTS_PREFIX)).filter(
    (k) => !k.startsWith(livePrefix) && !k.startsWith(deletedPrefix),
  );
  expect(others.length).toBeGreaterThan(0);

  await signIn(page, "admin");
  await page.goto(ADMIN_EDITOR);
  const heading = page.getByRole("heading", { name: m.title });
  await expect(heading).toHaveCount(1);
  // The module header: its title and, next to it, its own Delete.
  const header = heading.locator("xpath=..");
  page.once("dialog", (d) => void d.accept());
  await header.getByRole("button", { name: S.delete, exact: true }).click();
  await expect(heading).toHaveCount(0);

  const check = testSql();
  const left = await check`select id from modules where id = ${m.id}`;
  await check.end();
  expect(left).toHaveLength(0);
  expect(await listKeys(store(), livePrefix)).toEqual([]);
  expect(await listKeys(store(), deletedPrefix)).toEqual([]);
  expect(
    (await listKeys(store(), ATTACHMENTS_PREFIX)).filter((k) => others.includes(k)).sort(),
  ).toEqual(others.sort());
});
