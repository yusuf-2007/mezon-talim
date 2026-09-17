import "server-only";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { applicationsRepository } from "@/lib/db/repositories/applications";
import { auditRepository } from "@/lib/db/repositories/audit";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import type { AdminNavBadges } from "@/components/admin/admin-nav-model";

/**
 * The counts the admin rail carries.
 *
 * One call for the whole nav, made once in the layout and passed down, rather
 * than each row asking for its own number. An accountant never sees the three
 * `manage` rows, so their queries are skipped rather than run and discarded.
 */
export async function getAdminNavBadges(canManage: boolean): Promise<AdminNavBadges> {
  const [payments, applications, questions, certificates] = await Promise.all([
    paymentsRepository.statusCounts(),
    canManage ? applicationsRepository.countByStatus() : Promise.resolve([]),
    canManage ? messagesRepository.unansweredCounts() : Promise.resolve([]),
    canManage ? certificatesRepository.pendingIssuance(100) : Promise.resolve([]),
  ]);

  const byStatus = new Map(payments.map((r) => [r.status, Number(r.count)]));
  // "Needs a human": a payment stuck pending, or one the provider refused.
  const stuck = (byStatus.get("pending") ?? 0) + (byStatus.get("failed") ?? 0);

  return {
    applications: applications.find((r) => r.status === "new")?.count ?? 0,
    questions: questions.reduce((sum, r) => sum + Number(r.n), 0),
    certificates: certificates.length,
    payments: stuck,
  };
}

export type AdminHome = Awaited<ReturnType<typeof getAdminHome>>;

/**
 * Everything the admin home shows, in one call.
 *
 * The home is a work queue, so it leads with what is waiting: applications
 * nobody has rung back, questions nobody has answered, passes nobody has turned
 * into a certificate, payments that stalled. Revenue and course stats follow,
 * because they report rather than ask.
 */
export async function getAdminHome(canManage: boolean) {
  const [
    statusCounts,
    applications,
    threads,
    questionCounts,
    issuance,
    paymentCounts,
    overview,
    revenueByDay,
    courses,
    activity,
  ] = await Promise.all([
    canManage ? applicationsRepository.countByStatus() : Promise.resolve([]),
    canManage ? applicationsRepository.list(6) : Promise.resolve([]),
    canManage ? messagesRepository.listThreadsForAdmin(true, 3) : Promise.resolve([]),
    canManage ? messagesRepository.unansweredCounts() : Promise.resolve([]),
    canManage ? certificatesRepository.pendingIssuance(100) : Promise.resolve([]),
    paymentsRepository.statusCounts(),
    analyticsRepository.overview(),
    analyticsRepository.revenueByDay(30),
    analyticsRepository.topCourses(4),
    canManage ? auditRepository.recentWithActor(6) : Promise.resolve([]),
  ]);

  const now = Date.now();
  const byStatus = new Map(statusCounts.map((r) => [r.status, Number(r.count)]));
  const payByStatus = new Map(paymentCounts.map((r) => [r.status, Number(r.count)]));

  return {
    queue: {
      newApplications: byStatus.get("new") ?? 0,
      // The funnel is weighted by count, so a zero segment must not vanish
      // silently — it renders at zero width with its label still shown.
      funnel: (["new", "contacted", "enrolled", "declined"] as const).map((status) => ({
        status,
        count: byStatus.get(status) ?? 0,
      })),
      openQuestions: questionCounts.reduce((sum, r) => sum + Number(r.n), 0),
      oldestQuestionAt: threads[0]?.createdAt ?? null,
      pendingCertificates: issuance.length,
      pendingPayments: payByStatus.get("pending") ?? 0,
      failedPayments: payByStatus.get("failed") ?? 0,
    },
    applications: applications.filter((a) => a.status === "new").slice(0, 3),
    // Age is measured here, not in the component: a render must not read the
    // clock, and this is the one place the row is already being assembled.
    threads: threads.map((q) => ({
      ...q,
      ageHours: Math.max(1, Math.round((now - new Date(q.createdAt).getTime()) / 3_600_000)),
    })),
    overview,
    revenueByDay,
    courses,
    activity,
  };
}
