import "server-only";
import { resolveSmsSender } from "./eskiz";
import { resolveEmailSender } from "./resend";

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

export function getEmailSender(): EmailSender {
  // Resend (with dev-console fallback). Email delivery is an allowed off-shore
  // service — transport only, no personal data stored abroad.
  return resolveEmailSender();
}

export function getSmsSender(): SmsSender {
  // Eskiz SMS (with dev-console fallback). Implemented early for phone-OTP login.
  return resolveSmsSender();
}
