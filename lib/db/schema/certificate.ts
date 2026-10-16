import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, modules } from "./catalog";
import {
  certificateKind,
  createdAt,
  type LocalizedText,
  timestamptz,
} from "./_shared";

/**
 * Auto-generated certificates: one per course (kind 'course') plus one per
 * module (kind 'module', the "milestone" certificates). The PDF lives in MinIO
 * (in-country); the public /verify/:code page reads by verification_code and
 * exposes only name, course (+ module), date, valid/revoked.
 *
 * Modules are hard-deleted, so a module certificate keeps working without its
 * module: module_id is SET NULL on delete and `module_title` is a snapshot
 * taken at issue (a rename never changes an issued certificate either).
 *
 * TBD #2 (cert authority): this is Mezon's OWN completion certificate. The
 * nullable `aaoifi_registration_ref` is a hook for a future official-exam handoff.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    kind: certificateKind("kind").notNull().default("course"),
    moduleId: uuid("module_id").references(() => modules.id, {
      onDelete: "set null",
    }),
    moduleTitle: jsonb("module_title").$type<LocalizedText>(), // snapshot at issue
    verificationCode: text("verification_code").notNull().unique(), // public, powers /verify/:code
    pdfObjectKey: text("pdf_object_key"), // MinIO key (in-country)
    aaoifiRegistrationRef: text("aaoifi_registration_ref"), // TBD #2 hook
    issuedAt: timestamptz("issued_at").defaultNow().notNull(),
    revokedAt: timestamptz("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // At most one ACTIVE certificate per (student, course) and per (student,
    // module). Revoked rows are history and stay out of both: re-issue keeps
    // the revoked row next to the fresh one. These close the check-then-insert
    // race — a concurrent second issue fails here and reads the winner back.
    uniqueIndex("certificates_one_active_course_uq")
      .on(t.userId, t.courseId)
      .where(sql`${t.kind} = 'course' and ${t.revokedAt} is null`),
    uniqueIndex("certificates_one_active_module_uq")
      .on(t.userId, t.moduleId)
      .where(
        sql`${t.kind} = 'module' and ${t.revokedAt} is null and ${t.moduleId} is not null`,
      ),
  ],
);
