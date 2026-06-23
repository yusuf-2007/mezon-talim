import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { verificationTokens } from "../schema";

/**
 * Verification tokens (Auth.js adapter table). Reused for password-reset links:
 * identifier = email, token = hashed reset token, expires = short TTL.
 */
export const verificationTokensRepository = {
  async create(identifier: string, tokenHash: string, expires: Date) {
    await db
      .insert(verificationTokens)
      .values({ identifier, token: tokenHash, expires });
  },

  async find(identifier: string, tokenHash: string) {
    const [row] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, tokenHash),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async delete(identifier: string, tokenHash: string) {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, tokenHash),
        ),
      );
  },
};
