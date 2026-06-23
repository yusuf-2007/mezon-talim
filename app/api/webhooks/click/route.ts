import { handleClickWebhook } from "@/lib/payments/click";

// Click SHOP API Prepare/Complete callbacks. Outside [locale]; excluded from the
// i18n proxy. Node runtime (crypto + DB). Signature is verified inside.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await handleClickWebhook(request);
  } catch {
    // Generic failure → Click treats negative error as "failed to update".
    return Response.json({ error: -7, error_note: "Internal error" });
  }
}
