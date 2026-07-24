import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendUnansweredDigests } from "@/lib/notifications/digest";

/**
 * Daily digest trigger (vercel.json cron, 04:00 UTC = 09:00 Tashkent).
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically when the
 * env var is set; without CRON_SECRET configured the endpoint stays disabled.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await sendUnansweredDigests();
  return NextResponse.json({ ok: true, ...summary });
}
