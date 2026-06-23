import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses } from "./catalog";
import { createdAt, timestamptz } from "./_shared";

/**
 * Auto-generated completion certificates. The PDF lives in MinIO (in-country);
 * the public /verify/:code page reads by verification_code and exposes only
 * name, course, date, valid/revoked.
 *
 * TBD #2 (cert authority): this is Mezon's OWN completion certificate. The
 * nullable `aaoifi_registration_ref` is a hook for a future official-exam handoff.
 */
export const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  verificationCode: text("verification_code").notNull().unique(), // public, powers /verify/:code
  pdfObjectKey: text("pdf_object_key"), // MinIO key (in-country)
  aaoifiRegistrationRef: text("aaoifi_registration_ref"), // TBD #2 hook
  issuedAt: timestamptz("issued_at").defaultNow().notNull(),
  revokedAt: timestamptz("revoked_at"),
  createdAt: createdAt(),
});
