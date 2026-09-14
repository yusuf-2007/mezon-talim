/**
 * Seed (or promote) a super_admin. Idempotent: if the email already exists it
 * is promoted to super_admin and its password reset; otherwise a new user is
 * created. Self-contained so it never imports `server-only` modules.
 *
 *   npm run db:seed
 *
 * Configure via env:
 *   SEED_ADMIN_PASSWORD  (required — no default, see below)
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_NAME  (optional)
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
const fullName = process.env.SEED_ADMIN_NAME ?? "Mezon Super Admin";

/**
 * No default password.
 *
 * This used to fall back to a literal, which put the working credential for a
 * super_admin account into a public repository — and the account it creates has
 * full control of users, courses and payment records. A default that is
 * convenient in development is indistinguishable from a backdoor once someone
 * runs the script against production, which is exactly what happened.
 *
 * Refusing to run is the only safe behaviour: there is no password this script
 * can invent that is both usable and not written down somewhere.
 */
const suppliedPassword = process.env.SEED_ADMIN_PASSWORD;
if (!suppliedPassword) {
  console.error(
    "SEED_ADMIN_PASSWORD is not set.\n" +
      "Set it to a password you generate, e.g.\n" +
      "  SEED_ADMIN_PASSWORD=\"$(openssl rand -base64 24)\" npm run db:seed",
  );
  process.exit(1);
}
if (suppliedPassword.length < 12) {
  console.error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}
const password: string = suppliedPassword;

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

  // Deliberately not echoed: the caller supplied it and CI logs are kept.
  console.info("  Password: the SEED_ADMIN_PASSWORD you supplied.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
