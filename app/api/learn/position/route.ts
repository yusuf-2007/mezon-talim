import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { positionSchema, saveLessonPosition } from "@/lib/learning/position";

/**
 * The lesson player reports the playhead here (resume, B3): every few seconds
 * of playback, on pause, and as the tab is hidden or closed. A route rather
 * than a server action so the last report can go out with `sendBeacon`,
 * which survives the page closing.
 */
export async function POST(request: Request) {
  // Same-site only. sendBeacon carries the session cookie; a cross-site page
  // must not be able to move a student's resume point.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new NextResponse(null, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  let body: unknown;
  try {
    // sendBeacon posts the JSON as text/plain, so parse the text ourselves.
    body = JSON.parse(await request.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = positionSchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const saved = await saveLessonPosition(user.id, parsed.data);
  return new NextResponse(null, { status: saved ? 204 : 403 });
}
