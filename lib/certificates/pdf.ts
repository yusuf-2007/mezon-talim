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
    issued: "Дата выдачи",
    code: "Код проверки",
    verify: "Проверьте подлинность",
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

  drawCentered(page, L.title, H - 168, bold, 40, NAVY);
  drawCentered(page, L.subtitle, H - 196, regular, 14, SLATE);

  // Recipient.
  drawCentered(page, L.certifies, H - 248, regular, 13, SLATE);
  drawCentered(page, data.studentName, H - 296, bold, 30, INK);

  drawCentered(page, L.completed, H - 340, regular, 13, SLATE);
  // Course title may be long — scale down to fit within the inner frame.
  let courseSize = 22;
  const maxCourseWidth = W - 200;
  while (
    bold.widthOfTextAtSize(data.courseTitle, courseSize) > maxCourseWidth &&
    courseSize > 12
  ) {
    courseSize -= 1;
  }
  drawCentered(page, data.courseTitle, H - 380, bold, courseSize, NAVY);

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
