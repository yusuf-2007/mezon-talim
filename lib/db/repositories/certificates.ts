import "server-only";
import { and, asc, desc, eq, ilike, isNull, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  assessments,
  attempts,
  certificates,
  courses,
  modules,
  users,
} from "../schema";
import type { LocalizedText } from "../schema";

export type CertificateKind = "course" | "module";

export type CertificateInsert = {
  userId: string;
  courseId: string;
  verificationCode: string;
  pdfObjectKey?: string | null;
  /** Defaults to 'course'. A 'module' row carries moduleId + moduleTitle. */
  kind?: CertificateKind;
  moduleId?: string | null;
  moduleTitle?: LocalizedText | null;
};

/**
 * Every lookup that means "the course certificate" must say kind = 'course':
 * module certificates share the table and the course id, and without the
 * filter the first module certificate would shadow the course certificate
 * (issuance would think it already exists, the queue would drop the student).
 */
const isCourseKind = () => eq(certificates.kind, "course");
const isModuleKind = () => eq(certificates.kind, "module");

/** Active first, then newest issued — a stable "latest" among history rows. */
const latestFirst = () => [
  sql`${certificates.revokedAt} is null desc`,
  desc(certificates.issuedAt),
  desc(certificates.id),
];

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

  /**
   * The user's ACTIVE course certificate for a course, or null. Course kind
   * only (a module certificate never counts); newest first if legacy data
   * somehow has two (the partial unique index prevents new ones).
   */
  async findForUserCourse(userId: string, courseId: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
          isCourseKind(),
          isNull(certificates.revokedAt),
        ),
      )
      .orderBy(desc(certificates.issuedAt), desc(certificates.id))
      .limit(1);
    return row ?? null;
  },

  /**
   * The user's latest course certificate INCLUDING revoked ones (active
   * preferred). Auto-issuance uses it so an admin revoke is not silently
   * undone by the next exam-result page view — re-issue is the admin's call.
   */
  async findLatestForUserCourse(userId: string, courseId: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
          isCourseKind(),
        ),
      )
      .orderBy(...latestFirst())
      .limit(1);
    return row ?? null;
  },

  /** The user's ACTIVE module certificate for a module, or null. */
  async findForUserModule(userId: string, moduleId: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.moduleId, moduleId),
          isModuleKind(),
          isNull(certificates.revokedAt),
        ),
      )
      .orderBy(desc(certificates.issuedAt), desc(certificates.id))
      .limit(1);
    return row ?? null;
  },

  /** Latest module certificate for (user, module) incl. revoked (active first). */
  async findLatestForUserModule(userId: string, moduleId: string) {
    const [row] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.moduleId, moduleId),
          isModuleKind(),
        ),
      )
      .orderBy(...latestFirst())
      .limit(1);
    return row ?? null;
  },

  /**
   * A user's module certificates in one course, incl. revoked, in module order
   * (modules deleted since issue sort last, by issue date). `moduleOrder` is
   * null when the module no longer exists; `moduleTitle` is the snapshot.
   */
  async listModuleCertsForUserCourse(userId: string, courseId: string) {
    return db
      .select({
        id: certificates.id,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        revokedAt: certificates.revokedAt,
        moduleId: certificates.moduleId,
        moduleTitle: certificates.moduleTitle,
        moduleOrder: modules.orderIndex,
      })
      .from(certificates)
      .leftJoin(modules, eq(modules.id, certificates.moduleId))
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
          isModuleKind(),
        ),
      )
      .orderBy(sql`${modules.orderIndex} asc nulls last`, asc(certificates.issuedAt));
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
        kind: certificates.kind,
        moduleId: certificates.moduleId,
        /** Snapshot taken at issue — survives a module rename or delete. */
        moduleTitle: certificates.moduleTitle,
        /** Current position of the module (null once it is deleted). */
        moduleOrder: modules.orderIndex,
      })
      .from(certificates)
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .leftJoin(modules, eq(modules.id, certificates.moduleId))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt));
  },

  /** All non-revoked certificates a user holds, both kinds (most recent first). */
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
  async listAll(
    opts: {
      search?: string;
      status?: "active" | "revoked";
      kind?: CertificateKind;
    } = {},
  ) {
    const q = opts.search?.trim();
    const conds = [];
    if (opts.status === "active") conds.push(isNull(certificates.revokedAt));
    if (opts.status === "revoked") conds.push(isNotNull(certificates.revokedAt));
    if (opts.kind) conds.push(eq(certificates.kind, opts.kind));
    if (q) {
      conds.push(
        or(
          ilike(users.fullName, `%${q}%`),
          ilike(users.email, `%${q}%`),
          ilike(certificates.verificationCode, `%${q}%`),
          sql`${courses.title}->>'uz' ilike ${`%${q}%`}`,
          sql`${certificates.moduleTitle}->>'uz' ilike ${`%${q}%`}`,
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
        kind: certificates.kind,
        moduleId: certificates.moduleId,
        moduleTitle: certificates.moduleTitle,
        moduleOrder: modules.orderIndex,
        /**
         * A revoked row that already has an ACTIVE replacement of the same
         * kind and target (course, or module) — re-issuing it again would
         * do nothing, so the ledger hides that action.
         */
        superseded: sql<boolean>`(${certificates.revokedAt} is not null and exists (
          select 1 from certificates c2
          where c2.user_id = ${certificates.userId}
            and c2.kind = ${certificates.kind}
            and c2.revoked_at is null
            and ((c2.kind = 'course' and c2.course_id = ${certificates.courseId})
              or (c2.kind = 'module' and c2.module_id = ${certificates.moduleId}))
        ))`,
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .leftJoin(modules, eq(modules.id, certificates.moduleId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(certificates.issuedAt));
  },

  /** Active module certificates per module of one course (admin module-tests page). */
  async countActiveModuleCertsByCourse(courseId: string): Promise<Map<string, number>> {
    const rows = await db
      .select({ moduleId: certificates.moduleId, n: sql<number>`count(*)` })
      .from(certificates)
      .where(
        and(
          eq(certificates.courseId, courseId),
          isModuleKind(),
          isNull(certificates.revokedAt),
          isNotNull(certificates.moduleId),
        ),
      )
      .groupBy(certificates.moduleId);
    return new Map(rows.map((r) => [r.moduleId as string, Number(r.n)]));
  },

  /**
   * Counts for the certificates stat cards. total/active/revoked span both
   * kinds; activeCourse / activeModule split ACTIVE certificates by kind, and
   * `byKind` gives each kind its own total/active/revoked (for the ledger's
   * filter chips once a kind filter is applied).
   */
  async statusCounts() {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${certificates.revokedAt} is null)`,
        revoked: sql<number>`count(*) filter (where ${certificates.revokedAt} is not null)`,
        totalCourse: sql<number>`count(*) filter (where ${certificates.kind} = 'course')`,
        totalModule: sql<number>`count(*) filter (where ${certificates.kind} = 'module')`,
        activeCourse: sql<number>`count(*) filter (where ${certificates.revokedAt} is null and ${certificates.kind} = 'course')`,
        activeModule: sql<number>`count(*) filter (where ${certificates.revokedAt} is null and ${certificates.kind} = 'module')`,
      })
      .from(certificates);
    const n = (v: number | undefined) => Number(v ?? 0);
    const totalCourse = n(row?.totalCourse);
    const totalModule = n(row?.totalModule);
    const activeCourse = n(row?.activeCourse);
    const activeModule = n(row?.activeModule);
    return {
      total: n(row?.total),
      active: n(row?.active),
      revoked: n(row?.revoked),
      activeCourse,
      activeModule,
      byKind: {
        course: { total: totalCourse, active: activeCourse, revoked: totalCourse - activeCourse },
        module: { total: totalModule, active: activeModule, revoked: totalModule - activeModule },
      },
    };
  },

  /**
   * Students who passed a final exam and have no COURSE certificate for that
   * course (a module certificate does not take them out of the queue; a
   * revoked course certificate does — re-issuing that is a deliberate admin
   * step). Course certificates only: module certificates are auto-issued.
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
          isCourseKind(),
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
