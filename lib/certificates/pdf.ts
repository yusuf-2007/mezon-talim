import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Certificate PDF generation. Uses embedded Noto Sans (Latin-extended +
 * Cyrillic) so Uzbek (oʻ gʻ) and Russian names/titles render correctly —
 * the standard PDF fonts (WinAnsi) cannot represent those glyphs.
 *
 * Generated server-side and either streamed on-demand or archived to MinIO
 * (in-country). Deterministic for a given input, so on-demand re-generation
 * always matches the issued certificate.
 */
export interface CertificateData {
  studentName: string;
  courseTitle: string; // already localized
  issuedAt: Date;
  verificationCode: string;
  verifyUrl: string;
  locale: Locale;
  /** Defaults to 'course'. A module certificate also needs `moduleTitle`. */
  kind?: "course" | "module";
  /** Module certificates: the module title, already localized (snapshot). */
  moduleTitle?: string;
}

const NAVY = rgb(0.043, 0.122, 0.227); // ~#0B1F3A
const GOLD = rgb(0.788, 0.635, 0.153); // ~#C9A227
const SLATE = rgb(0.42, 0.45, 0.5);
const INK = rgb(0.1, 0.13, 0.18);

const ASSETS = path.join(process.cwd(), "lib/certificates/assets");

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    readFile(path.join(ASSETS, "NotoSans-Regular.ttf")),
    readFile(path.join(ASSETS, "NotoSans-Bold.ttf")),
  ]);
  fontCache = {
    regular: new Uint8Array(regular),
    bold: new Uint8Array(bold),
  };
  return fontCache;
}

const LABELS: Record<Locale, Record<string, string>> = {
  uz: {
    org: "MEZON TA'LIM",
    title: "SERTIFIKAT",
    subtitle: "Tahsilni tamomlaganlik to'g'risida",
    certifies: "Ushbu sertifikat quyidagi shaxsga beriladi",
    completed: "quyidagi kursni muvaffaqiyatli tamomladi",
    moduleSubtitle: "Modulni tamomlaganlik to'g'risida",
    moduleCompleted: "quyidagi modulni muvaffaqiyatli tamomladi",
    // {course} is replaced by the course title.
    moduleOfCourse: "«{course}» kursi doirasida",
    issued: "Berilgan sana",
    code: "Tekshirish kodi",
    verify: "Haqiqiyligini tekshiring",
  },
  ru: {
    org: "MEZON TA'LIM",
    title: "СЕРТИФИКАТ",
    subtitle: "Об окончании обучения",
    certifies: "Настоящий сертификат выдан",
    completed: "успешно завершил(а) курс",
    moduleSubtitle: "Об окончании модуля",
    moduleCompleted: "успешно завершил(а) модуль",
    moduleOfCourse: "в рамках курса «{course}»",
    issued: "Дата выдачи",
    code: "Код проверки",
    verify: "Проверьте подлинность",
  },
  en: {
    org: "MEZON TA'LIM",
    title: "CERTIFICATE",
    subtitle: "Of course completion",
    certifies: "This certificate is awarded to",
    completed: "for successfully completing the course",
    moduleSubtitle: "Of module completion",
    moduleCompleted: "for successfully completing the module",
    moduleOfCourse: "as part of the course “{course}”",
    issued: "Date issued",
    code: "Verification code",
    verify: "Verify authenticity",
  },
};

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Draw text horizontally centered on the page at a given y. */
function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (page.getWidth() - width) / 2,
    y,
    size,
    font,
    color,
  });
}

/** Largest size in [min, max] at which `text` fits `maxWidth` (min if none). */
function fitSize(
  font: PDFFont,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
): number {
  let size = max;
  while (font.widthOfTextAtSize(text, size) > maxWidth && size > min) size -= 1;
  return size;
}

/**
 * Split `text` at the word break that best balances two lines (the wider of
 * the two as narrow as possible). Null when there is no break to use.
 */
function splitTwoLines(
  font: PDFFont,
  text: string,
): [string, string] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const w = Math.max(font.widthOfTextAtSize(a, 10), font.widthOfTextAtSize(b, 10));
    if (w < bestWidth) {
      bestWidth = w;
      best = [a, b];
    }
  }
  return best;
}

/**
 * The module variant's middle block: module title as the big line, then the
 * course it belongs to, smaller. The title shrinks from 22pt to 16pt on one
 * line; past that it wraps to two lines (each 20pt → 12pt) rather than
 * shrinking further. Returns nothing; draws at fixed positions above the footer.
 */
function drawModuleBlock(
  page: PDFPage,
  moduleTitle: string,
  courseLine: string,
  bold: PDFFont,
  regular: PDFFont,
  maxWidth: number,
  H: number,
) {
  const single = fitSize(bold, moduleTitle, maxWidth, 22, 16);
  const fitsOneLine = bold.widthOfTextAtSize(moduleTitle, single) <= maxWidth;
  const lines = fitsOneLine ? null : splitTwoLines(bold, moduleTitle);

  let bottom: number; // baseline of the last title line
  if (!lines) {
    // One line (fits, or one unbreakable word: keep shrinking to the floor).
    const size = fitsOneLine ? single : fitSize(bold, moduleTitle, maxWidth, 16, 10);
    drawCentered(page, moduleTitle, H - 380, bold, size, NAVY);
    bottom = H - 380;
  } else {
    let size = 20;
    while (
      size > 12 &&
      Math.max(
        bold.widthOfTextAtSize(lines[0], size),
        bold.widthOfTextAtSize(lines[1], size),
      ) > maxWidth
    ) {
      size -= 1;
    }
    const lead = Math.round(size * 1.25);
    drawCentered(page, lines[0], H - 372, bold, size, NAVY);
    drawCentered(page, lines[1], H - 372 - lead, bold, size, NAVY);
    bottom = H - 372 - lead;
  }

  const courseSize = fitSize(regular, courseLine, maxWidth, 13, 9);
  drawCentered(page, courseLine, bottom - 30, regular, courseSize, SLATE);
}

export async function generateCertificatePdf(
  data: CertificateData,
): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });

  // A4 landscape.
  const page = doc.addPage([842, 595]);
  const W = page.getWidth();
  const H = page.getHeight();
  const L = LABELS[data.locale];

  // Outer navy border + inner gold rule.
  page.drawRectangle({
    x: 24,
    y: 24,
    width: W - 48,
    height: H - 48,
    borderColor: NAVY,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: W - 68,
    height: H - 68,
    borderColor: GOLD,
    borderWidth: 1,
  });

  // Header.
  drawCentered(page, L.org, H - 96, bold, 20, NAVY);
  page.drawRectangle({
    x: W / 2 - 40,
    y: H - 108,
    width: 80,
    height: 2,
    color: GOLD,
  });

  const isModule = data.kind === "module";

  drawCentered(page, L.title, H - 168, bold, 40, NAVY);
  drawCentered(page, isModule ? L.moduleSubtitle : L.subtitle, H - 196, regular, 14, SLATE);

  // Recipient.
  drawCentered(page, L.certifies, H - 248, regular, 13, SLATE);
  drawCentered(page, data.studentName, H - 296, bold, 30, INK);

  drawCentered(page, isModule ? L.moduleCompleted : L.completed, H - 340, regular, 13, SLATE);
  const maxCourseWidth = W - 200;
  if (isModule) {
    drawModuleBlock(
      page,
      data.moduleTitle || "—",
      L.moduleOfCourse.replace("{course}", data.courseTitle),
      bold,
      regular,
      maxCourseWidth,
      H,
    );
  } else {
    // Course title may be long — scale down to fit within the inner frame.
    let courseSize = 22;
    while (
      bold.widthOfTextAtSize(data.courseTitle, courseSize) > maxCourseWidth &&
      courseSize > 12
    ) {
      courseSize -= 1;
    }
    drawCentered(page, data.courseTitle, H - 380, bold, courseSize, NAVY);
  }

  // Footer: issued date (left) + verification (right).
  const footY = 84;
  page.drawText(`${L.issued}: ${formatDate(data.issuedAt)}`, {
    x: 90,
    y: footY,
    size: 11,
    font: regular,
    color: SLATE,
  });

  const codeLine = `${L.code}: ${data.verificationCode}`;
  const codeWidth = bold.widthOfTextAtSize(codeLine, 11);
  page.drawText(codeLine, {
    x: W - 90 - codeWidth,
    y: footY,
    size: 11,
    font: bold,
    color: INK,
  });
  const verifyLine = `${L.verify}: ${data.verifyUrl}`;
  const verifyWidth = regular.widthOfTextAtSize(verifyLine, 9);
  page.drawText(verifyLine, {
    x: W - 90 - verifyWidth,
    y: footY - 16,
    size: 9,
    font: regular,
    color: SLATE,
  });

  return doc.save();
}
