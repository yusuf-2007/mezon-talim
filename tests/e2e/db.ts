import "dotenv/config";
import postgres from "postgres";

/**
 * Guarded DB access for the E2E suite. The suite seeds and WIPES tables, so it
 * must be impossible to point it at a real database by accident: it requires
 * an explicit E2E_TEST=1 opt-in AND a localhost DATABASE_URL.
 */
export function requireTestDb(): string {
  const url = process.env.DATABASE_URL;
  if (process.env.E2E_TEST !== "1") {
    throw new Error(
      "E2E suite refused to run: set E2E_TEST=1 (and point DATABASE_URL at a disposable local Postgres).",
    );
  }
  if (!url) throw new Error("E2E suite refused to run: DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `E2E suite refused to run: DATABASE_URL host is "${host}" — only localhost is allowed (the suite wipes tables).`,
    );
  }
  return url;
}

export function testSql() {
  return postgres(requireTestDb(), { max: 2 });
}

export const IDS = {
  course: "00000000-0000-4000-8000-000000000001",
  module: "00000000-0000-4000-8000-000000000002",
  lesson1: "00000000-0000-4000-8000-000000000011",
  lesson2: "00000000-0000-4000-8000-000000000012",
} as const;

export const USERS = {
  admin: { email: "admin@e2e.test", name: "E2E Admin" },
  studentA: { email: "student-a@e2e.test", name: "Talaba Alpha" },
  studentB: { email: "student-b@e2e.test", name: "Talaba Beta" },
} as const;

export const PASSWORD = "E2ePass123!";

/** Clear all user-generated community + authoring content between spec files. */
export async function wipeCommunity(sql: ReturnType<typeof testSql>) {
  await sql`delete from user_notifications`;
  await sql`delete from lesson_messages`;
  await sql`delete from lesson_comments`;
  await sql`delete from notes`;
  await sql`delete from video_questions`; // responses cascade
}
