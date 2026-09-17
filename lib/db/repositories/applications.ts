import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { courseApplications } from "../schema";

export type ApplicationSource =
  | "landing_cpss"
  | "landing_bim"
  | "landing_b2b"
  | "other";

export type ApplicationStatus = "new" | "contacted" | "enrolled" | "declined";

export type CourseApplication = typeof courseApplications.$inferSelect;

/**
 * Lead capture from the landing page's "Ariza qoldirish" form. Reads are for
 * the admin follow-up list; the public write path is the only unauthenticated
 * one, and it is rate-limited by its caller.
 */
export const applicationsRepository = {
  /** Store one application. `smsConsentAt` null means SMS is not permitted. */
  async create(input: {
    fullName: string;
    phone: string;
    organization?: string | null;
    source?: ApplicationSource;
    locale?: string | null;
    smsConsent: boolean;
  }): Promise<{ id: string }> {
    const [row] = await db
      .insert(courseApplications)
      .values({
        fullName: input.fullName,
        phone: input.phone,
        organization: input.organization ?? null,
        source: input.source ?? "landing_cpss",
        locale: input.locale ?? null,
        smsConsentAt: input.smsConsent ? sql`now()` : null,
      })
      .returning({ id: courseApplications.id });
    return row;
  },

  /**
   * True if this phone already applied within the last `hours`. Lets the action
   * treat a double-submit as success instead of stacking duplicate leads.
   */
  async hasRecent(phone: string, hours: number): Promise<boolean> {
    const [row] = await db
      .select({ id: courseApplications.id })
      .from(courseApplications)
      .where(
        and(
          eq(courseApplications.phone, phone),
          gte(
            courseApplications.createdAt,
            sql`now() - make_interval(hours => ${hours})`,
          ),
        ),
      )
      .limit(1);
    return Boolean(row);
  },

  /** Newest applications first, for the admin follow-up queue. */
  async list(limit = 100): Promise<CourseApplication[]> {
    return db
      .select()
      .from(courseApplications)
      .orderBy(desc(courseApplications.createdAt))
      .limit(limit);
  },

  /**
   * Filtered page of applications for the admin list.
   *
   * Filters are optional and compose; an absent one means "any". `total` comes
   * back with the rows because the footer needs a page count and running the
   * same predicate twice from the page would be easy to get subtly wrong.
   */
  async listFiltered(opts: {
    status?: ApplicationStatus;
    source?: ApplicationSource;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ rows: CourseApplication[]; total: number }> {
    const where = and(
      opts.status ? eq(courseApplications.status, opts.status) : undefined,
      opts.source ? eq(courseApplications.source, opts.source) : undefined,
    );
    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(courseApplications)
        .where(where)
        .orderBy(desc(courseApplications.createdAt))
        .limit(opts.limit ?? 50)
        .offset(opts.offset ?? 0),
      db.select({ n: count() }).from(courseApplications).where(where),
    ]);
    return { rows, total: Number(totalRow?.n ?? 0) };
  },

  async findById(id: string): Promise<CourseApplication | undefined> {
    const [row] = await db
      .select()
      .from(courseApplications)
      .where(eq(courseApplications.id, id))
      .limit(1);
    return row;
  },

  /** Move one application along the funnel. Returns the row as it now stands. */
  async setStatus(id: string, status: ApplicationStatus) {
    const [row] = await db
      .update(courseApplications)
      .set({ status })
      .where(eq(courseApplications.id, id))
      .returning();
    return row;
  },

  /** Count by source, so the filter chips can carry their own numbers. */
  async countBySource(): Promise<{ source: ApplicationSource; count: number }[]> {
    const rows = await db
      .select({ source: courseApplications.source, count: count() })
      .from(courseApplications)
      .groupBy(courseApplications.source);
    return rows as { source: ApplicationSource; count: number }[];
  },

  /** Count by status, for the admin dashboard. */
  async countByStatus(): Promise<{ status: ApplicationStatus; count: number }[]> {
    const rows = await db
      .select({ status: courseApplications.status, count: count() })
      .from(courseApplications)
      .groupBy(courseApplications.status);
    return rows as { status: ApplicationStatus; count: number }[];
  },
};
