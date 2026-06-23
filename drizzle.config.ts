import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. Schema lives in lib/db/schema (the swap boundary);
 * migrations are generated into /drizzle and committed to the repo — never edit
 * the schema via a GUI (CLAUDE.md §8).
 *
 * The fallback URL matches the docker-compose default so `db:generate` works
 * before .env exists; real runs read DATABASE_URL.
 */
export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://mezon:mezon@localhost:5432/mezon_talim",
  },
  verbose: true,
  strict: true,
});
