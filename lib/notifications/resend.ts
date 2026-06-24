import "server-only";
import { env } from "@/lib/env";
import type { EmailMessage, EmailSender } from "./index";

/**
 * Resend email sender. Email delivery is one of the two allowed off-shore
 * services (CLAUDE.md §1) — transport only; no personal data is stored abroad.
 *
 * Config-gated: a dev fallback (ConsoleEmailSender) logs messages when
 * RESEND_API_KEY is absent, so welcome/receipt/certificate emails are testable
 * locally before Resend onboarding completes (domain verification, etc.).
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const DEFAULT_FROM = "Mezon Ta'lim <no-reply@mezontalim.uz>";

class ResendEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<{ id: string }> {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend send failed: ${res.status} ${detail}`);
    }
    const json = (await res.json()) as { id?: string };
    return { id: String(json.id ?? "") };
  }
}

class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<{ id: string }> {
    console.info(
      `[dev EMAIL → ${message.to}] ${message.subject}\n` +
        (message.text ?? message.html.replace(/<[^>]+>/g, " ").trim()) +
        "\n(RESEND_API_KEY not set; set it to send for real.)",
    );
    return { id: `dev-${Date.now()}` };
  }
}

let cached: EmailSender | null = null;

export function resolveEmailSender(): EmailSender {
  if (cached) return cached;
  cached = env.RESEND_API_KEY ? new ResendEmailSender() : new ConsoleEmailSender();
  return cached;
}
