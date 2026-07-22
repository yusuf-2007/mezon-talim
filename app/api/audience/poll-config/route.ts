import { NextResponse } from "next/server";
import { settingsRepository } from "@/lib/db/repositories/settings";

/**
 * Public read of the active entry-poll variant. No auth, no personal data —
 * just which visual treatment the admin has selected. Short-cached so an admin
 * change propagates within a minute without hammering the DB on every visit.
 */
export async function GET() {
  try {
    const variant = await settingsRepository.getPollVariant();
    return NextResponse.json(
      { variant },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch {
    // Never break the marketing page over a settings read — fall back client-side.
    return NextResponse.json({ variant: null }, { status: 200 });
  }
}
