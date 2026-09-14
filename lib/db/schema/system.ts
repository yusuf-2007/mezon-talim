import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  createdAt,
  notificationChannel,
  notificationStatus,
  timestamptz,
  updatedAt,
} from "./_shared";

/**
 * Transactional notifications (email via Resend, SMS via Eskiz; telegram Later).
 * One row per send attempt for delivery auditing.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * Null for a login code sent to a number with no account yet — which is
     * every sign-up. Those are exactly the sends worth auditing (a code that
     * never arrives is a person who cannot register at all), so the column is
     * nullable rather than the row being skipped.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannel("channel").notNull(),
    type: text("type").notNull(), // e.g. 'welcome', 'receipt', 'certificate'
    status: notificationStatus("status").notNull().default("queued"),
    payload: jsonb("payload"),
    /** The provider's own id for this message — how a delivery report finds
     *  its row. Null until the send is accepted, and for the dev senders. */
    providerMessageId: text("provider_message_id"),
    /** The provider's raw status word (DELIVRD, REJECTD, email.bounced, …),
     *  kept verbatim: our five states are a lossy summary, and when delivery
     *  goes wrong the exact word is the thing worth having. */
    providerStatus: text("provider_status"),
    sentAt: timestamptz("sent_at"),
    deliveredAt: timestamptz("delivered_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // Every delivery report arrives keyed by the provider's id and by nothing
    // else, so this is the only way in from a webhook.
    index("notifications_provider_message_id_idx").on(t.providerMessageId),
  ],
);

/**
 * Generic key-value application settings — admin-tunable knobs that shouldn't
 * require a redeploy (e.g. the audience poll's visual variant). One row per
 * setting; `value` is JSONB so a setting can be a string, flag, or object.
 * Read through settingsRepository, never inline.
 */
/**
 * Fixed-window rate-limit counters, shared across serverless instances (the
 * in-memory Map reset on every deploy and never saw sibling instances). Rows
 * are upserted atomically by rateLimitsRepository.hit(); stale rows are
 * opportunistically swept. Not security-critical — blunts abusive bursts.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamptz("window_start").notNull(),
  count: integer("count").notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
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
