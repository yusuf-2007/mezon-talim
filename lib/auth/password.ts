import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing with argon2id (CLAUDE.md §3). Runs in the Node runtime only
 * (never Edge). Parameters follow OWASP's argon2id guidance.
 */
const ARGON2_OPTS = {
  // argon2id
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTS);
}

export function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  return verify(passwordHash, plain, ARGON2_OPTS);
}
