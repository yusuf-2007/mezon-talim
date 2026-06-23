import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  citext,
  createdAt,
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
  createdAt: createdAt(),
});
