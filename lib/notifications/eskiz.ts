import "server-only";
import { env } from "@/lib/env";
import type { SmsMessage, SmsSender } from "./index";

/**
 * Eskiz SMS sender (notify.eskiz.uz). In-country provider for OTP + transactional
 * SMS. Requires a concluded contract, a registered sender nickname, and
 * moderator-approved message templates before anything reaches a real handset —
 * an unapproved body is accepted by the API and then dropped by the operator.
 *
 * Token is obtained via email+password login and cached in memory. A dev
 * fallback (ConsoleSmsSender) logs messages when Eskiz creds are absent, so the
 * phone-OTP flow is testable locally before Eskiz onboarding completes.
 */
const ESKIZ_BASE = "https://notify.eskiz.uz/api";

/** Eskiz tokens last ~30 days; refresh early so we rarely meet a live 401. */
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;

/** OTP delivery sits in the login request path — never hang on a stalled Eskiz. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Error bodies are for our logs, not the student's screen. Keep them short. */
async function errorDetail(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "<unreadable body>";
  }
}

class EskizSmsSender implements SmsSender {
  #token: string | null = null;
  #tokenExpiresAt = 0;
  /** In-flight login, shared so concurrent sends don't each authenticate. */
  #login: Promise<string> | null = null;

  async #authenticate(): Promise<string> {
    const body = new FormData();
    body.set("email", env.ESKIZ_EMAIL!);
    body.set("password", env.ESKIZ_PASSWORD!);
    const res = await fetch(`${ESKIZ_BASE}/auth/login`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(
        `Eskiz auth failed: ${res.status} ${await errorDetail(res)}`,
      );
    }
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) throw new Error("Eskiz auth: no token in response");
    this.#token = token;
    this.#tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    return token;
  }

  async #getToken(): Promise<string> {
    if (this.#token && Date.now() < this.#tokenExpiresAt) return this.#token;
    // Collapse concurrent logins onto one request; clear the slot either way so
    // a failed login doesn't poison every later send with the same rejection.
    this.#login ??= this.#authenticate().finally(() => {
      this.#login = null;
    });
    return this.#login;
  }

  #invalidateToken(): void {
    this.#token = null;
    this.#tokenExpiresAt = 0;
  }

  /**
   * `canRetry` bounds the re-login path to a single extra attempt. Recursing
   * unconditionally on 401 loops forever once the credentials genuinely stop
   * working (expired contract, rotated gateway password).
   */
  async send(message: SmsMessage, canRetry = true): Promise<{ id: string }> {
    const token = await this.#getToken();
    const body = new FormData();
    // Eskiz expects national format without "+"; phoneSchema guarantees +998…
    body.set("mobile_phone", message.to.replace(/^\+/, ""));
    body.set("message", message.text);
    if (env.ESKIZ_FROM) body.set("from", env.ESKIZ_FROM);
    // Without this the queued id is the last we ever hear: Eskiz reports the
    // operator's verdict — DELIVRD, REJECTD, EXPIRED — only to this URL.
    if (message.callbackUrl) body.set("callback_url", message.callbackUrl);

    const res = await fetch(`${ESKIZ_BASE}/message/sms/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 401 && canRetry) {
      this.#invalidateToken();
      return this.send(message, false);
    }
    if (!res.ok) {
      throw new Error(
        `Eskiz send failed: ${res.status} ${await errorDetail(res)}`,
      );
    }

    // A 2xx is not an acceptance: Eskiz reports rejections in the body. Treat
    // anything without a queued id as a failure so the notifications table
    // doesn't record undelivered messages as sent.
    const json = (await res.json()) as {
      id?: string | number;
      status?: string;
      message?: string;
    };
    if (json.status === "error" || json.id == null || json.id === "") {
      throw new Error(
        `Eskiz rejected the message: ${json.status ?? "no status"} — ${json.message ?? "no detail"}`,
      );
    }
    return { id: String(json.id) };
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
