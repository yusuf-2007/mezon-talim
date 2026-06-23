import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyOtpLogin, verifyPasswordLogin } from "./verify";
import type { Role } from "./types";

/**
 * Auth.js v5 configuration. Sessions are JWT (encrypted cookie) — required with
 * the Credentials provider and matching CLAUDE.md §3.
 *
 * Two Credentials providers:
 *  - "password"  → email + argon2 password (primary email path).
 *  - "phone-otp" → phone + SMS OTP, gated by OTP_LOGIN_ENABLED (Eskiz).
 *
 * Route protection is enforced in server components via lib/auth helpers
 * (getCurrentUser / requireRole), not in the proxy — so this Node-only config
 * (argon2, postgres.js) never runs on the Edge.
 *
 * NOTE: the Auth.js tables already live in our in-country Postgres. The Drizzle
 * adapter is intentionally NOT attached yet — with Credentials + JWT it has no
 * runtime role. It gets wired when Google/social login lands (Later), at which
 * point the citext `email` column needs a cast to satisfy the adapter types.
 */

declare module "next-auth" {
  interface User {
    role?: Role;
    fullName?: string | null;
    phone?: string | null;
    locale?: "uz" | "ru";
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      fullName: string | null;
      phone: string | null;
      locale: "uz" | "ru";
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  logger: {
    error(error) {
      // A session cookie that can't be decoded (rotated AUTH_SECRET, corrupt
      // cookie) surfaces as JWTSessionError — benign; we treat it as logged-out.
      if (error?.name === "JWTSessionError") return;
      console.error(error);
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      id: "password",
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (creds) => verifyPasswordLogin(creds),
    }),
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        code: { label: "Code", type: "text" },
      },
      authorize: (creds) => verifyOtpLogin(creds),
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        // Sign-in: copy our domain fields onto the token.
        token.id = user.id as string;
        token.role = user.role ?? "student";
        token.fullName = user.fullName ?? user.name ?? null;
        token.phone = user.phone ?? null;
        token.locale = user.locale ?? "uz";
      }
      if (trigger === "update" && session) {
        if (typeof session.fullName === "string") token.fullName = session.fullName;
        if (session.locale === "uz" || session.locale === "ru") {
          token.locale = session.locale;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as Role) ?? "student";
      session.user.fullName = (token.fullName as string | null) ?? null;
      session.user.phone = (token.phone as string | null) ?? null;
      session.user.locale = (token.locale as "uz" | "ru") ?? "uz";
      return session;
    },
  },
});
