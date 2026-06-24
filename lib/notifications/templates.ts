import "server-only";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Bilingual (uz/ru) transactional message templates. Email bodies are wrapped
 * in a minimal navy/gold branded shell; SMS strings are short (single segment
 * where possible). No personal data leaves the country beyond the recipient
 * address + these transactional bodies (CLAUDE.md §1).
 */

const BRAND_NAVY = "#0B1F3A";
const BRAND_GOLD = "#C9A227";

function shell(title: string, bodyHtml: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a2330">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${BRAND_NAVY};border-radius:12px 12px 0 0;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:.5px">MEZON TA'LIM</span>
      <span style="display:block;height:3px;width:48px;background:${BRAND_GOLD};margin-top:8px"></span>
    </div>
    <div style="background:#fff;border:1px solid #e6e8ec;border-top:0;border-radius:0 0 12px 12px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_NAVY}">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="color:#7a828c;font-size:12px;text-align:center;margin:16px 0 0">${footer}</p>
  </div>
  </body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_NAVY};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${label}</a>`;
}

const FOOTER: Record<Locale, string> = {
  uz: "Mezon Ta'lim — AAOIFI shariah standartlari bo'yicha onlayn ta'lim.",
  ru: "Mezon Ta'lim — онлайн-обучение по шариатским стандартам AAOIFI.",
};

export type EmailTemplate = { subject: string; html: string; text: string };

/** Welcome email on signup. */
export function welcomeEmail(
  locale: Locale,
  data: { name: string; dashboardUrl: string },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Здравствуйте, ${data.name}!</p>
      <p>Добро пожаловать в Mezon Ta'lim. Ваш аккаунт создан — начните обучение прямо сейчас.</p>
      <p style="margin-top:20px">${button(data.dashboardUrl, "Перейти к обучению")}</p>`;
    return {
      subject: "Добро пожаловать в Mezon Ta'lim",
      html: shell("Добро пожаловать!", body, FOOTER.ru),
      text: `Здравствуйте, ${data.name}! Добро пожаловать в Mezon Ta'lim. Начните обучение: ${data.dashboardUrl}`,
    };
  }
  const body = `<p>Assalomu alaykum, ${data.name}!</p>
    <p>Mezon Ta'limga xush kelibsiz. Hisobingiz yaratildi — hoziroq o'qishni boshlang.</p>
    <p style="margin-top:20px">${button(data.dashboardUrl, "O'qishni boshlash")}</p>`;
  return {
    subject: "Mezon Ta'limga xush kelibsiz",
    html: shell("Xush kelibsiz!", body, FOOTER.uz),
    text: `Assalomu alaykum, ${data.name}! Mezon Ta'limga xush kelibsiz. O'qishni boshlang: ${data.dashboardUrl}`,
  };
}

/** Payment receipt email after a verified enrollment. */
export function receiptEmail(
  locale: Locale,
  data: { courseTitle: string; amount: string; courseUrl: string },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Спасибо за покупку!</p>
      <p>Вы записаны на курс <b>${data.courseTitle}</b>.</p>
      <p>Сумма оплаты: <b>${data.amount}</b></p>
      <p style="margin-top:20px">${button(data.courseUrl, "Открыть курс")}</p>`;
    return {
      subject: `Чек об оплате — ${data.courseTitle}`,
      html: shell("Оплата получена", body, FOOTER.ru),
      text: `Спасибо за покупку! Вы записаны на «${data.courseTitle}». Сумма: ${data.amount}. ${data.courseUrl}`,
    };
  }
  const body = `<p>Xaridingiz uchun rahmat!</p>
    <p>Siz <b>${data.courseTitle}</b> kursiga yozildingiz.</p>
    <p>To'lov summasi: <b>${data.amount}</b></p>
    <p style="margin-top:20px">${button(data.courseUrl, "Kursni ochish")}</p>`;
  return {
    subject: `To'lov cheki — ${data.courseTitle}`,
    html: shell("To'lov qabul qilindi", body, FOOTER.uz),
    text: `Xaridingiz uchun rahmat! Siz "${data.courseTitle}" kursiga yozildingiz. Summa: ${data.amount}. ${data.courseUrl}`,
  };
}

/** Certificate-issued email. */
export function certificateEmail(
  locale: Locale,
  data: { courseTitle: string; verifyUrl: string; code: string },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Поздравляем! 🎓</p>
      <p>Вы успешно завершили курс <b>${data.courseTitle}</b> и получили сертификат.</p>
      <p>Код проверки: <b>${data.code}</b></p>
      <p style="margin-top:20px">${button(data.verifyUrl, "Открыть сертификат")}</p>`;
    return {
      subject: `Ваш сертификат — ${data.courseTitle}`,
      html: shell("Сертификат получен", body, FOOTER.ru),
      text: `Поздравляем! Вы завершили «${data.courseTitle}». Сертификат (код ${data.code}): ${data.verifyUrl}`,
    };
  }
  const body = `<p>Tabriklaymiz! 🎓</p>
    <p>Siz <b>${data.courseTitle}</b> kursini muvaffaqiyatli tamomladingiz va sertifikat oldingiz.</p>
    <p>Tekshirish kodi: <b>${data.code}</b></p>
    <p style="margin-top:20px">${button(data.verifyUrl, "Sertifikatni ochish")}</p>`;
  return {
    subject: `Sertifikatingiz — ${data.courseTitle}`,
    html: shell("Sertifikat berildi", body, FOOTER.uz),
    text: `Tabriklaymiz! Siz "${data.courseTitle}" kursini tamomladingiz. Sertifikat (kod ${data.code}): ${data.verifyUrl}`,
  };
}

/** Short payment-confirmation SMS. */
export function paymentConfirmSms(
  locale: Locale,
  data: { courseTitle: string; amount: string },
): string {
  return locale === "ru"
    ? `Mezon Ta'lim: оплата ${data.amount} получена. Вы записаны на «${data.courseTitle}».`
    : `Mezon Ta'lim: ${data.amount} to'lov qabul qilindi. "${data.courseTitle}" kursiga yozildingiz.`;
}

/** Exam-reminder SMS (e.g. mock/final exam availability or retry window). */
export function examReminderSms(
  locale: Locale,
  data: { courseTitle: string },
): string {
  return locale === "ru"
    ? `Mezon Ta'lim: не забудьте про экзамен по курсу «${data.courseTitle}».`
    : `Mezon Ta'lim: "${data.courseTitle}" kursi imtihonini unutmang.`;
}
