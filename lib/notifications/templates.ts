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

/**
 * Escape a value before it is interpolated into an email body.
 *
 * Names and course titles are author- and student-supplied, and these templates
 * build HTML by string concatenation. An unescaped apostrophe in a name like
 * O'Brien is enough to break the markup; an unescaped angle bracket is enough
 * to inject it.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_NAVY};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${label}</a>`;
}

const FOOTER: Record<Locale, string> = {
  uz: "Mezon Ta'lim — AAOIFI shariah standartlari bo'yicha onlayn ta'lim.",
  ru: "Mezon Ta'lim — онлайн-обучение по шариатским стандартам AAOIFI.",
  en: "Mezon Ta'lim — online learning for AAOIFI Shariah Standards.",
};

export type EmailTemplate = { subject: string; html: string; text: string };

/** Welcome email on signup. */
export function welcomeEmail(
  locale: Locale,
  data: { name: string; dashboardUrl: string },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Здравствуйте, ${esc(data.name)}!</p>
      <p>Добро пожаловать в Mezon Ta'lim. Ваш аккаунт создан — начните обучение прямо сейчас.</p>
      <p style="margin-top:20px">${button(data.dashboardUrl, "Перейти к обучению")}</p>`;
    return {
      subject: "Добро пожаловать в Mezon Ta'lim",
      html: shell("Добро пожаловать!", body, FOOTER.ru),
      text: `Здравствуйте, ${data.name}! Добро пожаловать в Mezon Ta'lim. Начните обучение: ${data.dashboardUrl}`,
    };
  }
  const body = `<p>Assalomu alaykum, ${esc(data.name)}!</p>
    <p>Mezon Ta'limga xush kelibsiz. Hisobingiz yaratildi — hoziroq o'qishni boshlang.</p>
    <p style="margin-top:20px">${button(data.dashboardUrl, "O'qishni boshlash")}</p>`;
  return {
    subject: "Mezon Ta'limga xush kelibsiz",
    html: shell("Xush kelibsiz!", body, FOOTER.uz),
    text: `Assalomu alaykum, ${data.name}! Mezon Ta'limga xush kelibsiz. O'qishni boshlang: ${data.dashboardUrl}`,
  };
}

/**
 * Daily instructor digest: unanswered private student questions, one line per
 * course. `lines` are pre-formatted "Course title — N" strings.
 */
export function unansweredDigestEmail(
  locale: Locale,
  data: { total: number; lines: string[]; inboxUrl: string },
): EmailTemplate {
  const list = data.lines
    .map((l) => `<li style="margin:4px 0">${l}</li>`)
    .join("");
  if (locale === "ru") {
    const body = `<p>У вас <b>${data.total}</b> неотвеченных вопросов от студентов:</p>
      <ul style="padding-left:20px;margin:12px 0">${list}</ul>
      <p style="margin-top:20px">${button(data.inboxUrl, "Ответить на вопросы")}</p>`;
    return {
      subject: `Неотвеченные вопросы студентов: ${data.total}`,
      html: shell("Вопросы ждут ответа", body, FOOTER.ru),
      text: `У вас ${data.total} неотвеченных вопросов от студентов. ${data.inboxUrl}`,
    };
  }
  const body = `<p>Sizda talabalardan <b>${data.total}</b> ta javobsiz savol bor:</p>
    <ul style="padding-left:20px;margin:12px 0">${list}</ul>
    <p style="margin-top:20px">${button(data.inboxUrl, "Savollarga javob berish")}</p>`;
  return {
    subject: `Javobsiz talaba savollari: ${data.total} ta`,
    html: shell("Savollar javob kutmoqda", body, FOOTER.uz),
    text: `Sizda talabalardan ${data.total} ta javobsiz savol bor. ${data.inboxUrl}`,
  };
}

/** Payment receipt email after a verified enrollment. */
export function receiptEmail(
  locale: Locale,
  data: { courseTitle: string; amount: string; courseUrl: string },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Спасибо за покупку!</p>
      <p>Вы записаны на курс <b>${esc(data.courseTitle)}</b>.</p>
      <p>Сумма оплаты: <b>${data.amount}</b></p>
      <p style="margin-top:20px">${button(data.courseUrl, "Открыть курс")}</p>`;
    return {
      subject: `Чек об оплате — ${data.courseTitle}`,
      html: shell("Оплата получена", body, FOOTER.ru),
      text: `Спасибо за покупку! Вы записаны на «${data.courseTitle}». Сумма: ${data.amount}. ${data.courseUrl}`,
    };
  }
  const body = `<p>Xaridingiz uchun rahmat!</p>
    <p>Siz <b>${esc(data.courseTitle)}</b> kursiga yozildingiz.</p>
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
      <p>Вы успешно завершили курс <b>${esc(data.courseTitle)}</b> и получили сертификат.</p>
      <p>Код проверки: <b>${data.code}</b></p>
      <p style="margin-top:20px">${button(data.verifyUrl, "Открыть сертификат")}</p>`;
    return {
      subject: `Ваш сертификат — ${data.courseTitle}`,
      html: shell("Сертификат получен", body, FOOTER.ru),
      text: `Поздравляем! Вы завершили «${data.courseTitle}». Сертификат (код ${data.code}): ${data.verifyUrl}`,
    };
  }
  const body = `<p>Tabriklaymiz! 🎓</p>
    <p>Siz <b>${esc(data.courseTitle)}</b> kursini muvaffaqiyatli tamomladingiz va sertifikat oldingiz.</p>
    <p>Tekshirish kodi: <b>${data.code}</b></p>
    <p style="margin-top:20px">${button(data.verifyUrl, "Sertifikatni ochish")}</p>`;
  return {
    subject: `Sertifikatingiz — ${data.courseTitle}`,
    html: shell("Sertifikat berildi", body, FOOTER.uz),
    text: `Tabriklaymiz! Siz "${data.courseTitle}" kursini tamomladingiz. Sertifikat (kod ${data.code}): ${data.verifyUrl}`,
  };
}

/**
 * Email-address confirmation link.
 *
 * Sent when an account claims an address — at email sign-up, or from the
 * profile page. The address is not written to the user row until this link is
 * followed, so the wording has to work for someone who may not yet have an
 * account they recognise: it names the site and says what clicking does.
 */
export function emailVerificationEmail(
  locale: Locale,
  data: { name: string; verifyUrl: string; hours: number },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Здравствуйте, ${esc(data.name)}!</p>
      <p>Подтвердите этот адрес, чтобы привязать его к вашему аккаунту Mezon Ta'lim.</p>
      <p style="margin-top:20px">${button(data.verifyUrl, "Подтвердить адрес")}</p>
      <p style="color:#7a828c;font-size:13px;margin-top:20px">Ссылка действует ${data.hours} ч. Если вы этого не запрашивали, просто проигнорируйте письмо.</p>`;
    return {
      subject: "Подтвердите вашу почту — Mezon Ta'lim",
      html: shell("Подтверждение адреса", body, FOOTER.ru),
      text: `Здравствуйте, ${data.name}! Подтвердите адрес для аккаунта Mezon Ta'lim: ${data.verifyUrl} (ссылка действует ${data.hours} ч)`,
    };
  }
  const body = `<p>Assalomu alaykum, ${esc(data.name)}!</p>
    <p>Bu manzilni Mezon Ta'lim hisobingizga bog'lash uchun tasdiqlang.</p>
    <p style="margin-top:20px">${button(data.verifyUrl, "Manzilni tasdiqlash")}</p>
    <p style="color:#7a828c;font-size:13px;margin-top:20px">Havola ${data.hours} soat amal qiladi. Agar bu siz bo'lmasangiz, xatni e'tiborsiz qoldiring.</p>`;
  return {
    subject: "Elektron pochtangizni tasdiqlang — Mezon Ta'lim",
    html: shell("Manzilni tasdiqlash", body, FOOTER.uz),
    text: `Assalomu alaykum, ${data.name}! Mezon Ta'lim hisobingiz uchun manzilni tasdiqlang: ${data.verifyUrl} (havola ${data.hours} soat amal qiladi)`,
  };
}

/** Password-reset link. */
export function passwordResetEmail(
  locale: Locale,
  data: { name: string; resetUrl: string; hours: number },
): EmailTemplate {
  if (locale === "ru") {
    const body = `<p>Здравствуйте, ${esc(data.name)}!</p>
      <p>Вы запросили сброс пароля для Mezon Ta'lim.</p>
      <p style="margin-top:20px">${button(data.resetUrl, "Задать новый пароль")}</p>
      <p style="color:#7a828c;font-size:13px;margin-top:20px">Ссылка действует ${data.hours} ч. Если вы этого не запрашивали, пароль останется прежним — ничего делать не нужно.</p>`;
    return {
      subject: "Сброс пароля — Mezon Ta'lim",
      html: shell("Сброс пароля", body, FOOTER.ru),
      text: `Здравствуйте, ${data.name}! Задайте новый пароль: ${data.resetUrl} (ссылка действует ${data.hours} ч)`,
    };
  }
  const body = `<p>Assalomu alaykum, ${esc(data.name)}!</p>
    <p>Siz Mezon Ta'lim uchun parolni tiklashni so'radingiz.</p>
    <p style="margin-top:20px">${button(data.resetUrl, "Yangi parol o'rnatish")}</p>
    <p style="color:#7a828c;font-size:13px;margin-top:20px">Havola ${data.hours} soat amal qiladi. Agar bu siz bo'lmasangiz, parolingiz o'zgarmaydi — hech narsa qilish shart emas.</p>`;
  return {
    subject: "Parolni tiklash — Mezon Ta'lim",
    html: shell("Parolni tiklash", body, FOOTER.uz),
    text: `Assalomu alaykum, ${data.name}! Yangi parol o'rnating: ${data.resetUrl} (havola ${data.hours} soat amal qiladi)`,
  };
}

/**
 * Login OTP SMS. Wording is fixed by Eskiz moderation, not by us:
 * an authorization-code message must name the resource AND the purpose of the
 * code or the operator drops it (Eskiz "My texts" clause 2).
 *
 * This string must match Eskiz template 86318 character for character:
 *   Mezon Ta'lim (mezontalim.uz) saytiga kirish uchun tasdiqlash kodi: %d Kod 5 daqiqa amal qiladi.
 * Note there is no full stop after the code — the moderator's %d absorbed the
 * one that was submitted, and %d matches digits only, so sending "1234." would
 * miss the pattern. A missed pattern is accepted by the API and dropped by the
 * operator, i.e. it fails silently.
 *
 * Every character here must stay inside the GSM 03.38 set. The apostrophe in
 * "Ta'lim" is deliberately ASCII U+0027, not the orthographically correct
 * Uzbek U+02BB and not a curly U+2019: one non-GSM character moves the whole
 * message to the Unicode tariff, dropping the limit from 160 to 70, which
 * makes this 98-character body cost two SMS on every single login.
 * `npm run check:sms` guards both properties. See docs/eskiz-setup.md.
 */
export function otpSms(code: string): string {
  return `Mezon Ta'lim (mezontalim.uz) saytiga kirish uchun tasdiqlash kodi: ${code} Kod 5 daqiqa amal qiladi.`;
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
