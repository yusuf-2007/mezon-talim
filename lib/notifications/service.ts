import "server-only";
import { getEmailSender, getSmsSender } from "./index";
import {
  certificateEmail,
  examReminderSms,
  paymentConfirmSms,
  receiptEmail,
  welcomeEmail,
  type EmailTemplate,
} from "./templates";
import { notificationsRepository } from "@/lib/db/repositories/notifications";
import { usersRepository } from "@/lib/db/repositories/users";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Transactional notification service. Every send is recorded in the
 * `notifications` table (queued → sent/failed) for auditing, then dispatched.
 *
 * All functions are BEST-EFFORT: they never throw to the caller, so a flaky
 * email/SMS provider can't break signup, payment, or certificate issuance.
 */

function baseUrl(): string {
  return (env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function localePath(locale: Locale, path: string): string {
  return `${baseUrl()}/${locale}${path}`;
}

type UserRow = NonNullable<Awaited<ReturnType<typeof usersRepository.findById>>>;

function displayName(user: UserRow): string {
  return user.fullName || user.name || user.email || "—";
}

/** Record + dispatch one email; swallow errors after marking the row. */
export async function dispatchEmail(
  userId: string,
  type: string,
  to: string | null,
  tpl: EmailTemplate,
): Promise<void> {
  if (!to) return; // phone-only account, no email on file
  const row = await notificationsRepository.record({
    userId,
    channel: "email",
    type,
    payload: { to, subject: tpl.subject },
  });
  try {
    await getEmailSender().send({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    await notificationsRepository.markSent(row.id);
  } catch (err) {
    console.error(`notification email '${type}' failed:`, err);
    await notificationsRepository.markFailed(row.id);
  }
}

/** Record + dispatch one SMS; swallow errors after marking the row. */
async function dispatchSms(
  userId: string,
  type: string,
  to: string | null,
  text: string,
): Promise<void> {
  if (!to) return; // no phone on file
  const row = await notificationsRepository.record({
    userId,
    channel: "sms",
    type,
    payload: { to },
  });
  try {
    await getSmsSender().send({ to, text });
    await notificationsRepository.markSent(row.id);
  } catch (err) {
    console.error(`notification sms '${type}' failed:`, err);
    await notificationsRepository.markFailed(row.id);
  }
}

/** Welcome email on signup. */
export async function notifyWelcome(userId: string): Promise<void> {
  try {
    const user = await usersRepository.findById(userId);
    if (!user) return;
    const locale = (user.locale ?? "uz") as Locale;
    await dispatchEmail(
      userId,
      "welcome",
      user.email,
      welcomeEmail(locale, {
        name: displayName(user),
        dashboardUrl: localePath(locale, "/dashboard"),
      }),
    );
  } catch (err) {
    console.error("notifyWelcome failed (non-fatal):", err);
  }
}

/** Payment receipt: email + SMS, after a verified enrollment. */
export async function notifyReceipt(
  userId: string,
  courseId: string,
  amountTiyin: number,
): Promise<void> {
  try {
    const [user, course] = await Promise.all([
      usersRepository.findById(userId),
      coursesRepository.findById(courseId),
    ]);
    if (!user || !course) return;
    const locale = (user.locale ?? "uz") as Locale;
    const courseTitle = pickLocale(course.title, locale);
    const amount = formatTiyin(amountTiyin, locale);
    const courseUrl = localePath(locale, `/courses/${course.slug}`);

    await dispatchEmail(
      userId,
      "receipt",
      user.email,
      receiptEmail(locale, { courseTitle, amount, courseUrl }),
    );
    await dispatchSms(
      userId,
      "payment_confirm",
      user.phone,
      paymentConfirmSms(locale, { courseTitle, amount }),
    );
  } catch (err) {
    console.error("notifyReceipt failed (non-fatal):", err);
  }
}

/** Certificate-issued email. */
export async function notifyCertificateIssued(
  userId: string,
  courseId: string,
  verificationCode: string,
): Promise<void> {
  try {
    const [user, course] = await Promise.all([
      usersRepository.findById(userId),
      coursesRepository.findById(courseId),
    ]);
    if (!user || !course) return;
    const locale = (user.locale ?? "uz") as Locale;
    await dispatchEmail(
      userId,
      "certificate",
      user.email,
      certificateEmail(locale, {
        courseTitle: pickLocale(course.title, locale),
        verifyUrl: `${baseUrl()}/verify/${verificationCode}`,
        code: verificationCode,
      }),
    );
  } catch (err) {
    console.error("notifyCertificateIssued failed (non-fatal):", err);
  }
}

/** Exam-reminder SMS (used by reminder jobs; available now for manual sends). */
export async function notifyExamReminder(
  userId: string,
  courseId: string,
): Promise<void> {
  try {
    const [user, course] = await Promise.all([
      usersRepository.findById(userId),
      coursesRepository.findById(courseId),
    ]);
    if (!user || !course) return;
    const locale = (user.locale ?? "uz") as Locale;
    await dispatchSms(
      userId,
      "exam_reminder",
      user.phone,
      examReminderSms(locale, { courseTitle: pickLocale(course.title, locale) }),
    );
  } catch (err) {
    console.error("notifyExamReminder failed (non-fatal):", err);
  }
}
