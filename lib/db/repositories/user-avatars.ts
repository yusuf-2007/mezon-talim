import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { userAvatars } from "../schema";

/**
 * Student avatars stored in-country in the DB (resized webp). Kept in a separate
 * table so the hot users.findById path never pulls image bytes.
 */
export const userAvatarsRepository = {
  async get(userId: string) {
    const [row] = await db
      .select()
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId))
      .limit(1);
    return row ?? null;
  },

  /** True if the user has an avatar (cheap — no image bytes fetched). */
  async exists(userId: string) {
    const [row] = await db
      .select({ userId: userAvatars.userId })
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId))
      .limit(1);
    return Boolean(row);
  },

  async upsert(userId: string, dataBase64: string, contentType: string) {
    await db
      .insert(userAvatars)
      .values({ userId, dataBase64, contentType })
      .onConflictDoUpdate({
        target: userAvatars.userId,
        set: { dataBase64, contentType, updatedAt: new Date() },
      });
  },

  async remove(userId: string) {
    await db.delete(userAvatars).where(eq(userAvatars.userId, userId));
  },
};
