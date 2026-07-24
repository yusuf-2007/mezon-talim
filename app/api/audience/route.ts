import { NextResponse } from "next/server";
import { z } from "zod";
import { audienceRepository } from "@/lib/db/repositories/audience";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Anonymous entry-poll endpoint. Public (no auth) — records a single
 * self-declared occupation per browser. Not linked to any user or IP; the
 * `visitorId` is a random id the browser generated. Dedup-guarded so a browser
 * only ever counts once, and rate-limited against abuse.
 */

const bodySchema = z.object({
  visitorId: z.uuid(),
  occupation: z
    .enum(["student", "business_owner", "corporate_employee", "educator", "other"])
    .nullable(),
  landingPath: z.string().max(512).optional(),
  referrer: z.string().max(512).optional(),
  locale: z.string().max(8).optional(),
});

export async function POST(req: Request) {
  // Coarse global rate limit (the visitor id is client-controlled, so also cap
  // total writes to blunt scripted spam).
  if (!(await checkRateLimit("audience:global", 600, 60_000)).ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { visitorId, occupation, landingPath, referrer, locale } = parsed.data;

  // Per-visitor cap + one-row dedup: a browser only ever counts once.
  if (!(await checkRateLimit(`audience:${visitorId}`, 3, 60_000)).ok) {
    return NextResponse.json({ ok: true, deduped: true });
  }
  if (await audienceRepository.hasResponded(visitorId)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Keep only the referrer host, never the full URL/query (no personal data).
  let referrerHost: string | null = null;
  if (referrer) {
    try {
      referrerHost = new URL(referrer).host || null;
    } catch {
      referrerHost = null;
    }
  }

  await audienceRepository.record({
    visitorId,
    occupation,
    landingPath: landingPath ?? null,
    referrer: referrerHost,
    locale: locale ?? null,
  });

  return NextResponse.json({ ok: true });
}
