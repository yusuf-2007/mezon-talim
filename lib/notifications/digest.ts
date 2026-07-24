import "server-only";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { usersRepository } from "@/lib/db/repositories/users";
import { pickLocale } from "@/lib/i18n/localized";
import { env } from "@/lib/env";
import { dispatchEmail } from "./service";
import { unansweredDigestEmail } from "./templates";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Daily instructor digest (triggered by the cron route): for every course
 * author with unanswered private student questions, send one email listing
 * the per-course counts with a link into their inbox. Best-effort per
 * recipient; without a configured email provider the send is recorded as
 * failed and nothing else happens.
 */
export async function sendUnansweredDigests(): Promise<{
  authorsNotified: number;
  totalUnanswered: number;
}> {
  const counts = await messagesRepository.unansweredCounts();
  if (counts.length === 0) return { authorsNotified: 0, totalUnanswered: 0 };

  // courseId → total unanswered + a lesson to deep-link non-admin authors to.
  const perCourse = new Map<string, { n: number; lessonId: string }>();
  for (const row of counts) {
    const cur = perCourse.get(row.courseId);
    perCourse.set(row.courseId, {
      n: (cur?.n ?? 0) + row.n,
      lessonId: cur?.lessonId ?? row.lessonId,
    });
  }

  // Group courses by author.
  const byAuthor = new Map<
    string,
    { courseId: string; title: string; n: number; lessonId: string }[]
  >();
  for (const [courseId, { n, lessonId }] of perCourse) {
    const course = await coursesRepository.findById(courseId);
    if (!course?.createdBy) continue;
    const list = byAuthor.get(course.createdBy) ?? [];
    list.push({
      courseId,
      title: pickLocale(course.title, "uz") ?? course.slug,
      n,
      lessonId,
    });
    byAuthor.set(course.createdBy, list);
  }

  const base = (env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let authorsNotified = 0;
  let totalUnanswered = 0;

  for (const [authorId, courses] of byAuthor) {
    const author = await usersRepository.findById(authorId);
    if (!author?.email) continue;
    const locale = (author.locale ?? "uz") as Locale;
    const total = courses.reduce((sum, c) => sum + c.n, 0);
    totalUnanswered += total;

    // Super admins get the Messages inbox; teachers deep-link into a lesson's
    // ask tab (the admin panel is super_admin-only).
    const inboxUrl =
      author.role === "super_admin"
        ? `${base}/${locale}/admin/messages?section=ask`
        : `${base}/${locale}/learn/${courses[0].courseId}/${courses[0].lessonId}?tab=ask`;

    await dispatchEmail(
      authorId,
      "unanswered_digest",
      author.email,
      unansweredDigestEmail(locale, {
        total,
        lines: courses.map((c) => `${c.title} — ${c.n}`),
        inboxUrl,
      }),
    );
    authorsNotified += 1;
  }

  return { authorsNotified, totalUnanswered };
}
