/**
 * Public entry point for the database module. Prefer importing repositories
 * from here. The raw `db` client is exported for migrations/seed scripts and
 * repository internals only — do not call it from UI or route handlers.
 */
export { db, schema } from "./client";
export type { Database } from "./client";
export * as repositories from "./repositories";
