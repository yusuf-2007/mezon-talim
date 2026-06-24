import "server-only";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import {
  certificates,
  courses,
  enrollments,
  payments,
  users,
} from "../schema";
import type { LocalizedText } from "../schema";

/**
 * Read-only analytics aggregates for the admin dashboard and finance reports
 * (B35). All sums are integer tiyin. Heavy on COUNT/SUM group-bys — kept in one
 * place so the dashboard composes a handful of typed calls.
 */
export const analyticsRepository = {
  /** Headline KPIs for the dashboard. */
  async overview() {
    const [revenue] = await db
      .select({
        totalTiyin: sql<number>`coalesce(sum(${payments.amountTiyin}), 0)`,
        paidCount: sql<number>`count(*)`,
      })
      .from(payments)
      .where(eq(payments.status, "paid"));

    const [enr] = await db
      .select({ total: sql<number>`count(*)` })
      .from(enrollments);

    const [activeEnr] = await db
      .select({ total: sql<number>`count(*)` })
      .from(enrollments)
      .where(eq(enrollments.status, "active"));

    const [usr] = await db
      .select({ total: sql<number>`count(*)` })
      .from(users);

    const [students] = await db
      .select({ total: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "student"));

    const [crs] = await db
      .select({
        total: sql<number>`count(*)`,
        published: sql<number>`count(*) filter (where ${courses.status} = 'published')`,
      })
      .from(courses);

    const [certs] = await db
      .select({ total: sql<number>`count(*)` })
      .from(certificates)
      .where(sql`${certificates.revokedAt} is null`);

    const enrollmentTotal = Number(enr?.total ?? 0);
    const certTotal = Number(certs?.total ?? 0);

    return {
      totalRevenueTiyin: Number(revenue?.totalTiyin ?? 0),
      paidCount: Number(revenue?.paidCount ?? 0),
      enrollmentTotal,
      activeEnrollments: Number(activeEnr?.total ?? 0),
      userTotal: Number(usr?.total ?? 0),
      studentTotal: Number(students?.total ?? 0),
      courseTotal: Number(crs?.total ?? 0),
      publishedCourses: Number(crs?.published ?? 0),
      certificateTotal: certTotal,
      // Completion = certificates issued ÷ enrollments (B35).
      completionRatePct:
        enrollmentTotal > 0
          ? Math.round((certTotal / enrollmentTotal) * 100)
          : 0,
    };
  },

  /** Daily paid revenue for the last N days (oldest → newest), tiyin. */
  async revenueByDay(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${payments.createdAt}), 'YYYY-MM-DD')`,
        totalTiyin: sql<number>`coalesce(sum(${payments.amountTiyin}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(and(eq(payments.status, "paid"), gte(payments.createdAt, since)))
      .groupBy(sql`date_trunc('day', ${payments.createdAt})`)
      .orderBy(sql`date_trunc('day', ${payments.createdAt})`);
    return rows.map((r) => ({
      day: r.day,
      totalTiyin: Number(r.totalTiyin),
      count: Number(r.count),
    }));
  },

  /** Paid revenue split by provider. */
  async revenueByProvider() {
    const rows = await db
      .select({
        provider: payments.provider,
        totalTiyin: sql<number>`coalesce(sum(${payments.amountTiyin}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(eq(payments.status, "paid"))
      .groupBy(payments.provider);
    return rows.map((r) => ({
      provider: r.provider,
      totalTiyin: Number(r.totalTiyin),
      count: Number(r.count),
    }));
  },

  /** Most recent paid payments, with buyer + course. */
  async recentSales(limit = 10) {
    return db
      .select({
        id: payments.id,
        amountTiyin: payments.amountTiyin,
        provider: payments.provider,
        createdAt: payments.createdAt,
        userName: users.fullName,
        userEmail: users.email,
        courseTitle: courses.title,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .innerJoin(courses, eq(courses.id, payments.courseId))
      .where(eq(payments.status, "paid"))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  },

  /**
   * Every course with enrollment + paid-revenue stats (admin courses table).
   * Computed via two grouped aggregates merged in JS — joining enrollments and
   * payments together in one query would fan out and inflate the revenue sum.
   */
  async allCoursesWithStats() {
    const [courseRows, enrollAgg, payAgg] = await Promise.all([
      db
        .select({
          courseId: courses.id,
          slug: courses.slug,
          title: courses.title,
          status: courses.status,
          priceTiyin: courses.priceTiyin,
        })
        .from(courses)
        .where(isNull(courses.deletedAt)),
      db
        .select({
          courseId: enrollments.courseId,
          count: sql<number>`count(*)`,
        })
        .from(enrollments)
        .groupBy(enrollments.courseId),
      db
        .select({
          courseId: payments.courseId,
          total: sql<number>`coalesce(sum(${payments.amountTiyin}), 0)`,
        })
        .from(payments)
        .where(eq(payments.status, "paid"))
        .groupBy(payments.courseId),
    ]);

    const enrollMap = new Map(enrollAgg.map((r) => [r.courseId, Number(r.count)]));
    const payMap = new Map(payAgg.map((r) => [r.courseId, Number(r.total)]));

    return courseRows
      .map((r) => ({
        courseId: r.courseId,
        slug: r.slug,
        title: r.title as LocalizedText,
        status: r.status,
        priceTiyin: Number(r.priceTiyin),
        enrollments: enrollMap.get(r.courseId) ?? 0,
        revenueTiyin: payMap.get(r.courseId) ?? 0,
      }))
      .sort((a, b) => b.enrollments - a.enrollments);
  },

  /** Courses ranked by enrollment count. */
  async topCourses(limit = 5) {
    const rows = await db
      .select({
        courseId: courses.id,
        title: courses.title,
        status: courses.status,
        enrollments: sql<number>`count(${enrollments.id})`,
      })
      .from(courses)
      .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
      .groupBy(courses.id)
      .orderBy(desc(sql`count(${enrollments.id})`))
      .limit(limit);
    return rows.map((r) => ({
      courseId: r.courseId,
      title: r.title as LocalizedText,
      status: r.status,
      enrollments: Number(r.enrollments),
    }));
  },

  /** Daily enrollment counts for the last N days (oldest → newest). */
  async enrollmentsByDay(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${enrollments.startedAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(enrollments)
      .where(gte(enrollments.startedAt, since))
      .groupBy(sql`date_trunc('day', ${enrollments.startedAt})`)
      .orderBy(sql`date_trunc('day', ${enrollments.startedAt})`);
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  },

  /** Most recent enrollments with student + course (overview / analytics). */
  async recentEnrollments(limit = 7) {
    return db
      .select({
        id: enrollments.id,
        startedAt: enrollments.startedAt,
        userName: users.fullName,
        userEmail: users.email,
        courseTitle: courses.title,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .orderBy(desc(enrollments.startedAt))
      .limit(limit);
  },

  /** Latest signups. */
  async newUsers(limit = 5) {
    return db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
  },

  /** 30-day growth deltas (counts created within the window) for KPI badges. */
  async growth(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [u] = await db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, since));
    const [e] = await db
      .select({ n: sql<number>`count(*)` })
      .from(enrollments)
      .where(gte(enrollments.startedAt, since));
    return { newUsers: Number(u?.n ?? 0), newEnrollments: Number(e?.n ?? 0) };
  },
};
