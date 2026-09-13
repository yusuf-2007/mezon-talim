import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  citext,
  createdAt,
  occupation,
  timestamptz,
  updatedAt,
  userRole,
} from "./_shared";

/**
 * Identity & accounts. `users` extends the Auth.js adapter table with Mezon's
 * domain fields. `accounts` / `sessions` / `verification_tokens` are the
 * standard Auth.js (Drizzle adapter) tables. All personal data stays in-country.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- Auth.js adapter fields (the adapter writes these) ---
  name: text("name"),
  image: text("image"),
  email: citext("email").unique(), // nullable for phone-only signup
  emailVerified: timestamptz("email_verified"),

  // --- Mezon domain fields ---
  role: userRole("role").notNull().default("student"),
  fullName: text("full_name"),
  phone: text("phone").unique(), // E.164; primary login in UZ
  phoneVerified: timestamptz("phone_verified"), // via Eskiz OTP
  passwordHash: text("password_hash"), // argon2; null for social-only (later)
  locale: text("locale").notNull().default("uz"), // 'uz' | 'ru'

  isActive: boolean("is_active").notNull().default(true), // admin can deactivate an account
  bio: text("bio"), // short profile bio (admin-editable)
  occupation: occupation("occupation"), // self-declared at signup (audience analytics)

  notifyEmail: boolean("notify_email").notNull().default(true),
  notifySms: boolean("notify_sms").notNull().default(true),
  notifyTelegram: boolean("notify_telegram").notNull().default(false), // Later
  telegramChatId: text("telegram_chat_id"), // Later

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/**
 * Phone OTP login (Eskiz). Codes are stored hashed; verified codes are marked
 * consumed so they can't be replayed.
 */
export const phoneOtps = pgTable("phone_otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamptz("expires_at").notNull(),
  consumedAt: timestamptz("consumed_at"),
  // Wrong guesses against this code. Codes are 4 digits (10 000 combinations),
  // so an uncapped verify endpoint is walkable inside the 5-minute window;
  // the code is burned once this hits MAX_OTP_ATTEMPTS.
  attempts: integer("attempts").notNull().default(0),
  createdAt: createdAt(),
});

/**
 * Student avatar image, stored in-country in the DB (resized to a small square
 * webp on upload). Served via /api/avatars/[userId]. Separate table so the hot
 * users.findById path never pulls image bytes.
 */
export const userAvatars = pgTable("user_avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dataBase64: text("data_base64").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: updatedAt(),
});

/**
 * Pending email-address verifications.
 *
 * Deliberately NOT the Auth.js `verification_tokens` table: that one is keyed
 * by (identifier, token) alone, which cannot express "user X wants to claim
 * address Y" — the address being claimed is not yet on the user row, and must
 * not be written there until the link is clicked. Keeping the claim here means
 * an unverified address can never occupy `users.email` (and therefore can never
 * block the real owner from registering it).
 */
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The address being claimed, lower-cased. Not unique: two people may each
     *  have an outstanding claim on the same address; whoever confirms first wins
     *  and the loser's claim fails the uniqueness check at confirm time. */
    email: citext("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    consumedAt: timestamptz("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // Every confirmation click is a lookup by token, and it is the only way in
    // to this table from outside — unique because the tokens are 32 random
    // bytes, so a collision is a bug worth failing on rather than resolving.
    uniqueIndex("email_verifications_token_hash_idx").on(t.tokenHash),
    index("email_verifications_user_id_idx").on(t.userId),
  ],
);
