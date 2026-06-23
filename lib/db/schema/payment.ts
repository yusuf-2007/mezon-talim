import { bigint, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses } from "./catalog";
import {
  createdAt,
  paymentProvider,
  paymentStatus,
  updatedAt,
} from "./_shared";

/**
 * Payments via Click + Payme. Enrollment is created/activated ONLY on a verified
 * `paid` callback (verify Payme JSON-RPC + Click Prepare/Complete MD5 signature
 * server-side). `idempotency_key` guards double-processing; `raw_callback` keeps
 * the provider payload for audit. Personal/financial data stays in-country.
 */
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  provider: paymentProvider("provider").notNull(),
  // Money is integer tiyin (UZS × 100). Never float.
  amountTiyin: bigint("amount_tiyin", { mode: "number" }).notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  providerTxnId: text("provider_txn_id"),
  idempotencyKey: text("idempotency_key").unique(),
  rawCallback: jsonb("raw_callback"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
