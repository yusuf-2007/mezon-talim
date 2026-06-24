import { getCurrentUser } from "@/lib/auth";
import { userAvatarsRepository } from "@/lib/db/repositories/user-avatars";

/**
 * Serve a user's avatar image (resized webp stored in-country in the DB).
 * Authenticated users only; the UUID id is the lookup key.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const { userId } = await params;
  const avatar = await userAvatarsRepository.get(userId);
  if (!avatar) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(avatar.dataBase64, "base64");
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
