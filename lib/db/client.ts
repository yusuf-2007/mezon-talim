import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * The Drizzle client — the single swap boundary for data access.
 * Everything DB-related goes through `lib/db/*` repositories; never import this
 * directly from components or route handlers (see CLAUDE.md §2.5, §8).
 *
 * postgres.js connects lazily on first query, so importing this during build is
 * safe. A module-level singleton avoids exhausting connections under HMR.
 */
const globalForDb = globalThis as unknown as {
  __mezonPg?: ReturnType<typeof postgres>;
};

const queryClient =
  globalForDb.__mezonPg ?? postgres(env.DATABASE_URL, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__mezonPg = queryClient;
}

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
export { schema };
