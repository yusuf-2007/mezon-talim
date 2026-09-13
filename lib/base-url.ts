import "server-only";
import { env } from "@/lib/env";

/**
 * The public origin to build links against for anything that leaves the app —
 * email verification, password resets, receipts, certificates.
 *
 * `AUTH_URL` wins when set. Failing that, Vercel injects the project's *stable*
 * production domain, which is what an email should point at: the
 * per-deployment `VERCEL_URL` changes on every push, so a link built from it
 * rots as soon as the next deploy lands, and a link in an inbox may be clicked
 * weeks later.
 *
 * Getting this wrong is invisible where the link is built and fatal where it is
 * clicked. With `AUTH_URL` unset this used to fall straight through to
 * `http://localhost:3000`, which looks perfectly fine in a server log and is
 * dead in a recipient's inbox — so the fallback chain now ends somewhere real
 * on a deployed host.
 */
export function publicBaseUrl(): string {
  if (env.AUTH_URL) return env.AUTH_URL.replace(/\/$/, "");

  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
