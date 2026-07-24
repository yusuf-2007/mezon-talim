import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBellData } from "@/lib/notifications/bell-data";

const LOCALES = ["uz", "ru", "en"];

/**
 * Bell refresh endpoint: the dropdown polls this on tab focus / interval so
 * the badge stays fresh without a full page navigation. Data is always scoped
 * to the session user.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("locale") ?? "uz";
  const locale = LOCALES.includes(raw) ? raw : "uz";

  const data = await getBellData(user.id, user.role, locale);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
