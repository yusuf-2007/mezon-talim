import { index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, timestamptz } from "./_shared";

/**
 * Where a lead came in from. The landing page runs several CTAs into the same
 * form; keeping the origin lets sales see which section actually converts.
 */
export const applicationSource = pgEnum("application_source", [
  "landing_cpss",
  "landing_bim",
  "landing_b2b",
  "other",
]);

export const applicationStatus = pgEnum("application_status", [
  "new",
  "contacted",
  "enrolled",
  "declined",
]);

/**
 * Course applications ("Ariza qoldirish") from the landing page.
 *
 * Courses run in cohorts and the sale is consultative, so the landing page's
 * primary CTA captures a lead rather than taking a payment — this table is that
 * capture. Personal data (name, phone, employer), so it lives in the in-country
 * Postgres like everything else and is never forwarded abroad (ZRU-547).
 *
 * `smsConsentAt` is not decoration: Eskiz contract 1830-2026 §4.1.8 obliges us
 * to obtain and register a subscriber's prior consent before sending SMS, with
 * a 30 BRV penalty under §5.5 for sending without it. Null means the applicant
 * did not tick the box — reach them by phone call only, never by SMS.
 */
export const courseApplications = pgTable(
  "course_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(), // +998XXXXXXXXX
    organization: text("organization"), // optional employer
    source: applicationSource("source").notNull().default("landing_cpss"),
    status: applicationStatus("status").notNull().default("new"),
    locale: text("locale"), // which language they applied in
    smsConsentAt: timestamptz("sms_consent_at"), // null = no SMS allowed
    note: text("note"), // internal, set by staff
    createdAt: createdAt(),
  },
  (t) => [
    index("course_applications_created_at_idx").on(t.createdAt),
    index("course_applications_status_idx").on(t.status),
  ],
);
