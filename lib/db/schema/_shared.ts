import { customType, pgEnum, timestamp } from "drizzle-orm/pg-core";

/**
 * Shared building blocks for the Mezon Ta'lim schema.
 * Source of truth: /docs/data-model.md.
 */

// ---------------------------------------------------------------------------
// Custom column types
// ---------------------------------------------------------------------------

/**
 * Case-insensitive text — used for emails so "A@x.uz" == "a@x.uz".
 * Requires the `citext` Postgres extension (enabled in 0000 migration / docker init).
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/**
 * Per-locale content blob. Uzbek is required at launch; Russian is the
 * fast-follow (data entry, not a schema change). No Arabic — see CLAUDE.md.
 * Stored as JSONB for extensibility (data-model conventions §i18n).
 */
export type LocalizedText = {
  uz: string;
  ru?: string;
};

// ---------------------------------------------------------------------------
// Timestamp helpers (timestamptz, default now())
// ---------------------------------------------------------------------------

export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true });

export const createdAt = () => timestamptz("created_at").defaultNow().notNull();
export const updatedAt = () => timestamptz("updated_at").defaultNow().notNull();
/** Soft-delete marker on content tables; hard-delete only via admin. */
export const deletedAt = () => timestamptz("deleted_at");

// ---------------------------------------------------------------------------
// Enums (Postgres native enums)
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", [
  "student",
  "teacher",
  "super_admin",
  "accountant",
]);

export const courseStatus = pgEnum("course_status", [
  "draft",
  "published",
  "archived",
]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "expired",
  "refunded",
]);

export const assessmentType = pgEnum("assessment_type", [
  "lesson_quiz",
  "module_test",
  "final_exam",
  "mock_exam",
]);

export const questionType = pgEnum("question_type", [
  "single",
  "multiple",
  "true_false",
]);

export const paymentProvider = pgEnum("payment_provider", ["click", "payme"]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const notificationChannel = pgEnum("notification_channel", [
  "email",
  "sms",
  "telegram",
]);

export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
]);
