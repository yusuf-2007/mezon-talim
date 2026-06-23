import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { users } from "../schema";
import type { Role } from "@/lib/auth/types";

type NewUserWithPassword = {
  email: string;
  passwordHash: string;
  fullName?: string | null;
  role?: Role;
  locale?: "uz" | "ru";
};

/**
 * Users repository — the only place user rows are read/written (CLAUDE.md §2.5).
 * Auth flows (authorize, server actions) go through here, never the ORM directly.
 */
export const usersRepository = {
  async findById(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  },

  /** Email lookup is case-insensitive (citext column). */
  async findByEmail(email: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ?? null;
  },

  async findByPhone(phone: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    return row ?? null;
  },

  async createWithPassword(input: NewUserWithPassword) {
    const [row] = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.fullName ?? null,
        fullName: input.fullName ?? null,
        passwordHash: input.passwordHash,
        role: input.role ?? "student",
        locale: input.locale ?? "uz",
      })
      .returning();
    return row;
  },

  /** Create or fetch a phone-only user (used by OTP login once enabled). */
  async findOrCreateByPhone(phone: string, locale: "uz" | "ru" = "uz") {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;
    const [row] = await db
      .insert(users)
      .values({ phone, role: "student", locale })
      .returning();
    return row;
  },

  async setPasswordHash(userId: string, passwordHash: string) {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
  },

  async markPhoneVerified(userId: string) {
    await db
      .update(users)
      .set({ phoneVerified: sql`now()`, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
  },
};
