/**
 * Seed (or promote) a super_admin. Idempotent: if the email already exists it
 * is promoted to super_admin and its password reset; otherwise a new user is
 * created. Self-contained so it never imports `server-only` modules.
 *
 *   npm run db:seed
 *
 * Configure via env (falls back to dev defaults):
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "@node-rs/argon2";
import { users } from "../lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env).");
  process.exit(1);
}

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@mezontalim.uz";
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const fullName = process.env.SEED_ADMIN_NAME ?? "Mezon Super Admin";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, { schema: { users } });

  const passwordHash = await hash(password, ARGON2_OPTS);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ role: "super_admin", passwordHash })
      .where(eq(users.id, existing.id));
    console.info(`✓ Promoted existing user to super_admin: ${email}`);
  } else {
    await db.insert(users).values({
      email,
      name: fullName,
      fullName,
      passwordHash,
      role: "super_admin",
      locale: "uz",
    });
    console.info(`✓ Created super_admin: ${email}`);
  }

  console.info(`  Password: ${password}  (change after first login)`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
