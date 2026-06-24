import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { certificates } from "../schema";

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
