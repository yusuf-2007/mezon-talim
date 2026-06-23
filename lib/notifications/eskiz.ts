import "server-only";
import { env } from "@/lib/env";
import type { SmsMessage, SmsSender } from "./index";

/**
 * Eskiz SMS sender (notify.eskiz.uz). In-country provider for OTP + transactional
 * SMS. Requires a registered sender name and approved templates in production.
 *
 * Token is obtained via email+password login and cached in memory. A dev
 * fallback (ConsoleSmsSender) logs messages when Eskiz creds are absent, so the
 * phone-OTP flow is testable locally before Eskiz onboarding completes.
 */
const ESKIZ_BASE = "https://notify.eskiz.uz/api";

class EskizSmsSender implements SmsSender {
  #token: string | null = null;

  async #login(): Promise<string> {
    if (this.#token) return this.#token;
    const body = new FormData();
    body.set("email", env.ESKIZ_EMAIL!);
    body.set("password", env.ESKIZ_PASSWORD!);
    const res = await fetch(`${ESKIZ_BASE}/auth/login`, {
      method: "POST",
      body,
    });
    if (!res.ok) throw new Error(`Eskiz auth failed: ${res.status}`);
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) throw new Error("Eskiz auth: no token in response");
    this.#token = token;
    return token;
  }

  async send(message: SmsMessage): Promise<{ id: string }> {
    const token = await this.#login();
    const body = new FormData();
    // Eskiz expects national format without "+".
    body.set("mobile_phone", message.to.replace(/^\+/, ""));
    body.set("message", message.text);
    if (env.ESKIZ_FROM) body.set("from", env.ESKIZ_FROM);

    const res = await fetch(`${ESKIZ_BASE}/message/sms/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (res.status === 401) {
      // Token expired — re-login once.
      this.#token = null;
      return this.send(message);
    }
    if (!res.ok) throw new Error(`Eskiz send failed: ${res.status}`);
    const json = (await res.json()) as { id?: string | number };
    return { id: String(json.id ?? "") };
  }
}

class ConsoleSmsSender implements SmsSender {
  async send(message: SmsMessage): Promise<{ id: string }> {
    console.info(
      `[dev SMS → ${message.to}] ${message.text}\n` +
        "(Eskiz creds not set; set ESKIZ_EMAIL/ESKIZ_PASSWORD to send for real.)",
    );
    return { id: `dev-${Date.now()}` };
  }
}

let cached: SmsSender | null = null;

export function resolveSmsSender(): SmsSender {
  if (cached) return cached;
  cached =
    env.ESKIZ_EMAIL && env.ESKIZ_PASSWORD
      ? new EskizSmsSender()
      : new ConsoleSmsSender();
  return cached;
}
