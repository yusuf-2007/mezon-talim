import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit, { type Font } from "@pdf-lib/fontkit";
import sharp from "sharp";
import { MAX_SLIDE_PIXELS, isDeclaredSlide, type SlideDeclaration } from "./verify";

/**
 * Per-viewer watermark burned into view-only slides.
 *
 * What this is for, plainly: the web cannot stop a phone camera or an OS
 * screenshot tool that never tells the page. The viewer's client-side shield
 * deters casual saving; this watermark is what makes any capture that still
 * happens traceable to one account and one moment.
 *
 * The text is drawn as glyph OUTLINES, not SVG <text>: sharp renders SVG with
 * librsvg, which needs system fonts, and serverless hosts have none — <text>
 * comes out as empty boxes or nothing. Outlines from a bundled TTF render
 * identically everywhere. (next.config.ts ships the TTF via
 * outputFileTracingIncludes for /api/attachments/**.)
 */

// Noto Sans covers Uzbek Latin (incl. ʼ ‘ ’ ʻ), Cyrillic and the · separator.
const FONT_PATH = path.join(process.cwd(), "lib/certificates/assets/NotoSans-Bold.ttf");

let fontPromise: Promise<Font> | null = null;
function loadFont(): Promise<Font> {
  if (!fontPromise) {
    fontPromise = readFile(FONT_PATH)
      .then((buf) => fontkit.create(new Uint8Array(buf)))
      .catch((err) => {
        fontPromise = null; // let the next request retry
        throw err;
      });
  }
  return fontPromise;
}

const INK = "#0B1F3A"; // navy fill — reads on light slides
const HALO = "#FFFFFF"; // light stroke — reads on dark slides
const OPACITY = 0.13;
const ANGLE_DEG = -30;

export type WatermarkViewer = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
};

/** "+998 90 ***-**-67" — enough to identify, not enough to call. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (/^998\d{9}$/.test(d)) return `+998 ${d.slice(3, 5)} ***-**-${d.slice(-2)}`;
  if (d.length >= 6) return `+${d.slice(0, 3)} ***${d.slice(-2)}`;
  return "***";
}

/** "ab***@gmail.com" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, Math.min(2, at))}***@${email.slice(at + 1)}`;
}

/** "YYYY-MM-DD HH:mm" in Asia/Tashkent. */
export function formatTashkent(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * The watermark line:
 * `{name || "Mezon Taʼlim"} · ID {8 chars} · {masked phone|email} · {time}`.
 */
export function watermarkText(viewer: WatermarkViewer, now: Date = new Date()): string {
  const name = viewer.fullName?.trim().slice(0, 60) || "Mezon Taʼlim";
  const parts = [name, `ID ${viewer.id.slice(0, 8)}`];
  const contact = viewer.phone
    ? maskPhone(viewer.phone)
    : viewer.email
      ? maskEmail(viewer.email)
      : null;
  if (contact) parts.push(contact);
  parts.push(formatTashkent(now));
  return parts.join(" · ");
}

type Outline = {
  /** <path> elements in font units (y up), one per glyph. */
  paths: string;
  /** Advance width of the whole line, in font units. */
  width: number;
};

/** Lay the text out with the font's shaping and emit glyph outlines. */
function outline(font: Font, text: string): Outline {
  // A glyph the font lacks would render as a .notdef box; show "?" instead.
  const safe = [...text]
    .map((ch) => (font.hasGlyphForCodePoint(ch.codePointAt(0)!) ? ch : "?"))
    .join("");
  const run = font.layout(safe);
  let x = 0;
  let paths = "";
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const d = glyph.path.toSVG();
    if (d) {
      const gx = round(x + pos.xOffset);
      const gy = round(pos.yOffset);
      paths += `<path transform="translate(${gx} ${gy})" d="${d}"/>`;
    }
    x += pos.xAdvance;
  });
  return { paths, width: x };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Diagonal, staggered tiling of the line over a W×H slide, as SVG. */
function overlaySvg(font: Font, text: string, width: number, height: number): string {
  const { paths, width: lineUnits } = outline(font, text);
  const longEdge = Math.max(width, height);
  const fontPx = Math.max(9, Math.min(42, Math.round(longEdge * 0.016)));
  const k = fontPx / font.unitsPerEm; // font units → px
  const lineW = lineUnits * k;
  const gapX = fontPx * 3;
  const stepX = lineW + gapX;
  const stepY = fontPx * 5.5;
  // Rows/columns in the rotated frame (origin = slide centre), covering the
  // slide's half-diagonal; copies that would land fully off the slide are
  // culled so librsvg only rasterizes visible text.
  const radius = Math.hypot(width, height) / 2;
  const rows = Math.ceil(radius / stepY) + 1;
  const theta = (ANGLE_DEG * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const toSlide = (x: number, y: number) => [
    width / 2 + x * cos - y * sin,
    height / 2 + x * sin + y * cos,
  ];

  let uses = "";
  for (let r = -rows; r <= rows; r++) {
    const y = r * stepY;
    const stagger = (((r % 2) + 2) % 2) * (stepX / 2);
    const cMin = Math.floor((-radius - stagger - lineW / 2) / stepX);
    const cMax = Math.ceil((radius - stagger + lineW / 2) / stepX);
    for (let c = cMin; c <= cMax; c++) {
      const x0 = c * stepX + stagger - lineW / 2;
      const [ax, ay] = toSlide(x0, y);
      const [bx, by] = toSlide(x0 + lineW, y);
      const pad = fontPx * 1.5;
      const visible =
        Math.max(ax, bx) + pad >= 0 &&
        Math.min(ax, bx) - pad <= width &&
        Math.max(ay, by) + pad >= 0 &&
        Math.min(ay, by) - pad <= height;
      if (visible) uses += `<use href="#wm" x="${round(x0)}" y="${round(y)}"/>`;
    }
  }
  const strokeUnits = round((fontPx * 0.14) / k);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><g id="wm" transform="scale(${round(k * 1e4) / 1e4} ${-round(k * 1e4) / 1e4})">${paths}</g></defs>` +
    `<g transform="translate(${width / 2} ${height / 2}) rotate(${ANGLE_DEG})">` +
    `<g opacity="${OPACITY}" fill="none" stroke="${HALO}" stroke-width="${strokeUnits}" stroke-linejoin="round">${uses}</g>` +
    `<g opacity="${OPACITY}" fill="${INK}">${uses}</g>` +
    `</g></svg>`
  );
}

/** The stored bytes are not the slide their attachment row declares. */
export class UndeclaredSlideError extends Error {
  constructor() {
    super("stored slide does not match its declared format and size");
    this.name = "UndeclaredSlideError";
  }
}

/**
 * Encode one slide for a viewer: optionally resized to `width` (never
 * upscaled) and, when `watermark` is given, with that text burned in. Always
 * returns WebP. With neither option the stored bytes are returned unchanged.
 *
 * Every path first checks the bytes against `declared` (the attachment row's
 * slide format and this page's size) and throws UndeclaredSlideError when
 * they disagree — nothing that is not a real slide of that shape is decoded
 * or passed through.
 */
export async function renderSlide(
  input: Uint8Array,
  opts: { declared: SlideDeclaration; watermark?: string | null; width?: number },
): Promise<Uint8Array> {
  const { declared, watermark, width } = opts;
  if (!(await isDeclaredSlide(input, declared))) throw new UndeclaredSlideError();
  if (!watermark && !width) return input;

  const decodeOpts = { limitInputPixels: MAX_SLIDE_PIXELS };
  if (!watermark) {
    return sharp(input, decodeOpts)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  }

  const font = await loadFont();
  // Resize first (to raw pixels, so there is a single lossy encode at the end)
  // and read back the exact output size the overlay has to match.
  // Transparent areas become white, as they look on the viewer's white stage.
  let pipeline = sharp(input, decodeOpts).flatten({ background: "#ffffff" });
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const svg = overlaySvg(font, watermark, info.width, info.height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: width ? 80 : 82 })
    .toBuffer();
}
