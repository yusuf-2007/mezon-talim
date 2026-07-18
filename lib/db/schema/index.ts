/**
 * Mezon Ta'lim — MVP database schema (Drizzle).
 * Source of truth: /docs/data-model.md. "Later"-feature tables (community,
 * gamification, referrals, subscriptions) are intentionally NOT created yet;
 * the schema above is designed so they slot in without a rewrite.
 */
export * from "./_shared";
export * from "./auth";
export * from "./catalog";
export * from "./enrollment";
export * from "./assessment";
export * from "./payment";
export * from "./certificate";
export * from "./system";
export * from "./audience";
