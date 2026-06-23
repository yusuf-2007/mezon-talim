/**
 * Auth domain types. `Role` mirrors the `user_role` Postgres enum (single
 * source of truth is the DB schema). Keep these in sync with lib/db/schema.
 */
export type Role = "student" | "teacher" | "super_admin" | "accountant";

/** The minimal authenticated user shape the app reads from a session. */
export interface SessionUser {
  id: string;
  role: Role;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  locale: "uz" | "ru";
}
