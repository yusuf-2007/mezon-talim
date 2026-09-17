import "server-only";
import { and, desc, eq, ilike, isNull, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { assessments, attempts, certificates, courses, users } from "../schema";

export type CertificateInsert = {
  userId: string;
  courseId: string;
  verificationCode: string;
  pdfObjectKey?: string | null;
};

export const certificatesRepository = {
  async findByCode(code: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.verificationCode, code))
      .limit(1);
    return row ?? null;
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    return row ?? null;
  },

  /** A user's certificate for a course (one per pair; null if not issued). */
  async findForUserCourse(userId: string, courseId: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** ALL certificates a user holds incl. revoked, with course (admin detail). */
  async listForUserAll(userId: string) {
    return db
      .select({
        id: certificates.id,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        revokedAt: certificates.revokedAt,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(certificates)
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt));
  },

  /** All non-revoked certificates a user holds (most recent first). */
  async listForUser(userId: string) {
    return db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          isNull(certificates.revokedAt),
        ),
      )
      .orderBy(desc(certificates.issuedAt));
  },

  /** All certificates with student + course, for the admin table. */
  async listAll(opts: { search?: string; status?: "active" | "revoked" } = {}) {
    const q = opts.search?.trim();
    const conds = [];
    if (opts.status === "active") conds.push(isNull(certificates.revokedAt));
    if (opts.status === "revoked") conds.push(isNotNull(certificates.revokedAt));
    if (q) {
      conds.push(
        or(
          ilike(users.fullName, `%${q}%`),
          ilike(users.email, `%${q}%`),
          ilike(certificates.verificationCode, `%${q}%`),
          sql`${courses.title}->>'uz' ilike ${`%${q}%`}`,
        ),
      );
    }
    return db
      .select({
        id: certificates.id,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        revokedAt: certificates.revokedAt,
        userId: users.id,
        userName: users.fullName,
        userEmail: users.email,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(certificates.issuedAt));
  },

  /** Counts for the certificates stat cards. */
  async statusCounts() {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${certificates.revokedAt} is null)`,
        revoked: sql<number>`count(*) filter (where ${certificates.revokedAt} is not null)`,
      })
      .from(certificates);
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      revoked: Number(row?.revoked ?? 0),
    };
  },

  /**
   * Students who passed a final exam and have no certificate for that course.
   *
   * The issuance queue. A pass is the trigger, but issuing is deliberately a
   * human step — the name is printed on the document, and the design asks an
   * admin to eyeball the spelling before it is minted.
   *
   * Best passing attempt per (student, course), newest first.
   */
  async pendingIssuance(limit = 50) {
    return db
      .select({
        userId: users.id,
        userName: users.fullName,
        userEmail: users.email,
        courseId: assessments.courseId,
        courseTitle: courses.title,
        scorePct: sql<number>`max(${attempts.scorePct})`,
        attemptNo: sql<number>`min(${attempts.attemptNo})`,
        passedAt: sql<Date>`max(${attempts.submittedAt})`,
      })
      .from(attempts)
      .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
      .innerJoin(users, eq(users.id, attempts.userId))
      .innerJoin(courses, eq(courses.id, assessments.courseId))
      .leftJoin(
        certificates,
        and(
          eq(certificates.userId, attempts.userId),
          eq(certificates.courseId, assessments.courseId),
        ),
      )
      .where(
        and(
          eq(assessments.type, "final_exam"),
          eq(attempts.passed, true),
          eq(attempts.voided, false),
          isNull(certificates.id),
        ),
      )
      .groupBy(users.id, users.fullName, users.email, assessments.courseId, courses.title)
      .orderBy(sql`max(${attempts.submittedAt}) desc`)
      .limit(limit);
  },

  async create(input: CertificateInsert) {
    const [row] = await db.insert(certificates).values(input).returning();
    return row;
  },

  async setPdfObjectKey(id: string, key: string) {
    await db
      .update(certificates)
      .set({ pdfObjectKey: key })
      .where(eq(certificates.id, id));
  },

  async revoke(id: string) {
    await db
      .update(certificates)
      .set({ revokedAt: new Date() })
      .where(eq(certificates.id, id));
  },
};
