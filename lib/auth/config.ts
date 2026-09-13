import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { usersRepository } from "@/lib/db/repositories/users";
import { verifyPasswordLogin, verifyPhoneTicket } from "./verify";
import type { Role } from "./types";

/**
 * Auth.js v5 configuration. Sessions are JWT (encrypted cookie) — required with
 * the Credentials provider and matching CLAUDE.md §3.
 *
 * Two Credentials providers:
 *  - "password"     → email + argon2 password (the secondary path).
 *  - "phone-ticket" → a signed ticket proving a just-verified phone number,
 *    gated by OTP_LOGIN_ENABLED (Eskiz). This is the primary path in UZ and
 *    covers both sign-in and sign-up; see ./phone-ticket for why the OTP code
 *    itself is not the credential presented here.
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

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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
      id: "phone-ticket",
      name: "Phone",
      credentials: {
        ticket: { label: "Ticket", type: "text" },
        fullName: { label: "Full name", type: "text" },
        occupation: { label: "Occupation", type: "text" },
      },
      authorize: (creds) => verifyPhoneTicket(creds),
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Sign-in: copy our domain fields onto the token.
        token.id = user.id as string;
        token.role = user.role ?? "student";
        token.fullName = user.fullName ?? user.name ?? null;
        token.email = user.email ?? null;
        token.phone = user.phone ?? null;
        token.locale = user.locale ?? "uz";
      }

      // A JWT session is a snapshot, so anything that changes an identity field
      // — adding an email or a phone, renaming, an admin changing a role —
      // leaves the cookie describing an account that no longer exists in that
      // shape. Rather than trust the caller to hand over the right patch (which
      // is how a half-updated token gets written), re-read the row and take the
      // database's word for all of it.
      if (trigger === "update" && token.id) {
        const fresh = await usersRepository.findById(token.id as string);
        if (fresh) {
          token.role = fresh.role;
          token.fullName = fresh.fullName;
          token.email = fresh.email;
          token.phone = fresh.phone;
          token.locale = fresh.locale === "ru" ? "ru" : "uz";
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as Role) ?? "student";
      session.user.fullName = (token.fullName as string | null) ?? null;
      // Auth.js types `email` as a required string; a phone-only account has
      // none, and the app reads it through getCurrentUser() which narrows it
      // back to `string | null`.
      session.user.email = (token.email as string | null) ?? null as unknown as string;
      session.user.phone = (token.phone as string | null) ?? null;
      session.user.locale = (token.locale as "uz" | "ru") ?? "uz";
      return session;
    },
  },
});
