import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, occupation } from "./_shared";

/**
 * Anonymous audience signals from the entry occupation poll (spec: "who visited
 * but didn't register"). One row per browser that answered or skipped the poll.
 *
 * Deliberately NOT linked to a user or IP — `visitorId` is a random id generated
 * in the browser, so this stays anonymous and in-country (ZRU-547 friendly).
 * `occupation` is null when the visitor skipped (kept to measure response rate).
 */
export const audienceSignals = pgTable("audience_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitorId: uuid("visitor_id").notNull(), // anonymous, browser-generated
  occupation: occupation("occupation"), // null = skipped/dismissed
  landingPath: text("landing_path"), // where they entered
  referrer: text("referrer"), // traffic source host (e.g. instagram.com)
  locale: text("locale"),
  createdAt: createdAt(),
});
