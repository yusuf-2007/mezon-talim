import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  createdAt,
  notificationChannel,
  notificationStatus,
  timestamptz,
} from "./_shared";

/**
 * Transactional notifications (email via Resend, SMS via Eskiz; telegram Later).
 * One row per send attempt for delivery auditing.
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: notificationChannel("channel").notNull(),
  type: text("type").notNull(), // e.g. 'welcome', 'receipt', 'certificate'
  status: notificationStatus("status").notNull().default("queued"),
  payload: jsonb("payload"),
  sentAt: timestamptz("sent_at"),
  createdAt: createdAt(),
});

/**
 * Audit trail for sensitive admin/teacher actions (role changes, refunds,
 * publishes, cert revokes).
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  meta: jsonb("meta"),
  createdAt: createdAt(),
});
