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

/** See ConsoleEmailSender. Not a real domain; nothing can be sent to it. */
const BOUNCE_ADDRESS = "bounce@e2e.test";

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
    // One reserved address always fails, so the suite can prove that a refused
    // send is reported as refused. Reachable only on the no-API-key path, which
    // is to say never in production, where RESEND_API_KEY selects the real
    // sender. Per-recipient rather than a process flag, so one test can fail
    // while every other email in the same run still succeeds.
    if (message.to.toLowerCase() === BOUNCE_ADDRESS) {
      throw new Error(`simulated provider refusal for ${BOUNCE_ADDRESS}`);
    }
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
