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

  /** Count by status, for the admin dashboard. */
  async countByStatus(): Promise<{ status: ApplicationStatus; count: number }[]> {
    const rows = await db
      .select({ status: courseApplications.status, count: count() })
      .from(courseApplications)
      .groupBy(courseApplications.status);
    return rows as { status: ApplicationStatus; count: number }[];
  },
};
