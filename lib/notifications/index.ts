import "server-only";
import { resolveSmsSender } from "./eskiz";

/**
 * Transactional notifications. Email via Resend (external delivery is allowed —
 * non-personal transport), SMS via Eskiz (in-country). Telegram is Later.
 *
 * SMS (Eskiz) is implemented early to back phone-OTP login; email (Resend) is
 * wired in Phase 8. Every send should also be recorded in the `notifications`
 * table for delivery auditing.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsMessage {
  to: string; // E.164
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<{ id: string }>;
}

const NOT_IMPLEMENTED =
  "lib/notifications: senders not implemented until Phase 8.";

export function getEmailSender(): EmailSender {
  // TODO(phase-8): Resend client.
  throw new Error(NOT_IMPLEMENTED);
}

export function getSmsSender(): SmsSender {
  // Eskiz SMS (with dev-console fallback). Implemented early for phone-OTP login.
  return resolveSmsSender();
}
