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
import { publicBaseUrl } from "@/lib/base-url";
import { deliveryCallbackUrl } from "./callback";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Transactional notification service. Every send is recorded in the
 * `notifications` table (queued → sent/failed) for auditing, then dispatched.
 *
 * All functions are BEST-EFFORT: they never throw to the caller, so a flaky
 * email/SMS provider can't break signup, payment, or certificate issuance.
 */

function baseUrl(): string {
  return publicBaseUrl();
}

function localePath(locale: Locale, path: string): string {
  return `${baseUrl()}/${locale}${path}`;
}

type UserRow = NonNullable<Awaited<ReturnType<typeof usersRepository.findById>>>;

function displayName(user: UserRow): string {
  return user.fullName || user.name || user.email || "—";
}

/** Record + dispatch one email; swallow errors after marking the row. */
/**
 * What became of one send.
 *
 * Returned rather than thrown: most callers are right to carry on regardless —
 * a welcome email that bounces must not fail the sign-up. But the caller has to
 * be able to *know*, because one of them is telling a student "check your
 * inbox", and saying that when the provider refused the message is worse than
 * saying nothing.
 */
export type EmailOutcome = "sent" | "failed" | "no-address";

export async function dispatchEmail(
  userId: string,
  type: string,
  to: string | null,
  tpl: EmailTemplate,
): Promise<EmailOutcome> {
  if (!to) return "no-address"; // phone-only account, no email on file
  const row = await notificationsRepository.record({
    userId,
    channel: "email",
    type,
    payload: { to, subject: tpl.subject },
  });
  try {
    const { id } = await getEmailSender().send({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    // Keep the provider's id: a bounce arrives later carrying only that, and
    // without it the event has no row to attach to.
    await notificationsRepository.markSent(row.id, id);
    return "sent";
  } catch (err) {
    console.error(`notification email '${type}' failed:`, err);
    await notificationsRepository.markFailed(row.id);
    return "failed";
  }
}

/**
 * Record + send one SMS, rethrowing on failure.
 *
 * The login-code path needs the throw: a code that was not sent must abort the
 * attempt, because the alternative is an "active" code the student never
 * received, which the resend cooldown then hides for a minute. Everything else
 * goes through dispatchSms, which swallows.
 */
export async function sendTrackedSms(input: {
  /** Null for a number with no account yet — every sign-up code. */
  userId: string | null;
  type: string;
  to: string;
  text: string;
  /** Extra context kept on the row, e.g. the course a reminder was about. */
  payload?: Record<string, unknown>;
}): Promise<void> {
  const row = await notificationsRepository.record({
    userId: input.userId,
    channel: "sms",
    type: input.type,
    payload: { ...(input.payload ?? {}), to: input.to },
  });
  try {
    const { id } = await getSmsSender().send({
      to: input.to,
      text: input.text,
      callbackUrl: deliveryCallbackUrl(row.id),
    });
    await notificationsRepository.markSent(row.id, id);
  } catch (err) {
    await notificationsRepository.markFailed(row.id);
    throw err;
  }
}

/** Record + dispatch one SMS; swallow errors after marking the row. */
async function dispatchSms(
  userId: string,
  type: string,
  to: string | null,
  text: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (!to) return; // no phone on file
  try {
    await sendTrackedSms({ userId, type, to, text, payload });
  } catch (err) {
    console.error(`notification sms '${type}' failed:`, err);
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

/**
 * Exam-reminder SMS. Sent once per student per course, the moment the last
 * lesson is completed and a scored final exam is still unpassed — see
 * lib/learning/exam-reminder. Idempotent: a second call for the same pair is a
 * no-op, so callers do not have to remember whether they already fired.
 */
export async function notifyExamReminder(
  userId: string,
  courseId: string,
): Promise<void> {
  try {
    if (await notificationsRepository.existsForCourse(userId, "exam_reminder", courseId)) {
      return;
    }
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
      { courseId },
    );
  } catch (err) {
    console.error("notifyExamReminder failed (non-fatal):", err);
  }
}
