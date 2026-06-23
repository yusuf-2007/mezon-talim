import { handlePaymeWebhook } from "@/lib/payments/payme";

// Payme Merchant API (JSON-RPC) endpoint. Outside [locale]; excluded from the
// i18n proxy. Node runtime (DB). Basic auth + amounts verified inside.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePaymeWebhook(request);
}
