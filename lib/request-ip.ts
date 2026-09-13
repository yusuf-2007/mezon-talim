import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP, for rate-limit keys.
 *
 * On Vercel `x-forwarded-for` is written by the platform proxy and its first
 * entry is the real client; the header is not client-controllable there. Behind
 * any other proxy it is only as good as that proxy's configuration, which is
 * why nothing security-critical is decided by this value — it only widens a
 * rate-limit key so one abusive source cannot consume everyone's budget.
 */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
