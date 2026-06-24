import "server-only";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
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

  // --- Admin (user management, B35) ---

  /** List users for the admin table; optional case-insensitive name/email/phone search. */
  async listAll(opts: { search?: string; limit?: number } = {}) {
    const limit = opts.limit ?? 100;
    const q = opts.search?.trim();
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        locale: users.locale,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        q
          ? or(
              ilike(users.fullName, `%${q}%`),
              ilike(users.email, `%${q}%`),
              ilike(users.phone, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(limit);
    return rows;
  },

  async countByRole() {
    const rows = await db
      .select({ role: users.role, count: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.role);
    return rows.map((r) => ({ role: r.role, count: Number(r.count) }));
  },

  async setRole(userId: string, role: Role) {
    await db
      .update(users)
      .set({ role, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
  },

  /** Update editable profile fields from the admin user-detail page. */
  async updateProfile(
    userId: string,
    patch: {
      fullName?: string | null;
      bio?: string | null;
      locale?: "uz" | "ru";
      role?: Role;
    },
  ) {
    await db
      .update(users)
      .set({
        ...(patch.fullName !== undefined ? { fullName: patch.fullName, name: patch.fullName } : {}),
        ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
        ...(patch.locale ? { locale: patch.locale } : {}),
        ...(patch.role ? { role: patch.role } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId));
  },

  /** Activate / deactivate an account (admin). Inactive users can't sign in. */
  async setActive(userId: string, isActive: boolean) {
    await db
      .update(users)
      .set({ isActive, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
  },
};
