/**
 * Guards the Eskiz SMS bodies against silent cost blow-ups.
 *
 * Telephone networks pick the encoding from the message content, not from the
 * sender: an all-GSM body fits 160 characters per segment, but a single
 * character outside that set (Cyrillic, a curly quote, an em dash, №, an
 * emoji) moves the whole message to Unicode, where the limit drops to 70.
 * Each extra segment is billed as a separate SMS.
 *
 * The OTP body is the one that matters — it is the highest-volume message on
 * the platform and it sits at 100 characters, so losing the GSM tariff would
 * double its cost on every login. This script fails the build if that (or any
 * Uzbek body) stops being single-segment GSM.
 *
 * Run: npm run check:sms
 */
import {
  otpSms,
  paymentConfirmSms,
  examReminderSms,
} from "@/lib/notifications/templates";

/** GSM 03.38 basic set — one billed character each. */
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ" +
    "ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§" +
    "¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
/** GSM extension table — legal, but billed as two characters each. */
const GSM_EXT = new Set("^{}\\[~]|€");

type Report = {
  label: string;
  gsm: boolean;
  units: number;
  limit: number;
  segments: number;
  offenders: string[];
};

function measure(label: string, text: string): Report {
  const offenders = [
    ...new Set([...text].filter((c) => !GSM_BASIC.has(c) && !GSM_EXT.has(c))),
  ];
  const gsm = offenders.length === 0;
  // Unicode counts UTF-16 code units, so astral characters (emoji) cost two.
  const units = gsm
    ? [...text].reduce((n, c) => n + (GSM_EXT.has(c) ? 2 : 1), 0)
    : text.length;
  const [limit, perPart] = gsm ? [160, 153] : [70, 67];
  const segments = units <= limit ? 1 : Math.ceil(units / perPart);
  return { label, gsm, units, limit, segments, offenders };
}

/** A realistic worst case: our longest plausible course title. */
const TITLE = "AAOIFI Shari'ah standartlari";
const AMOUNT = "1 200 000 so'm";

// Uzbek bodies must stay single-segment GSM. Russian is Cyrillic by nature —
// always Unicode, so it is reported but not enforced.
const enforced = [
  measure("otpSms (uz)", otpSms("1234")),
  measure("paymentConfirmSms (uz)", paymentConfirmSms("uz", { courseTitle: TITLE, amount: AMOUNT })),
  measure("examReminderSms (uz)", examReminderSms("uz", { courseTitle: TITLE })),
];
const informational = [
  measure("paymentConfirmSms (ru)", paymentConfirmSms("ru", { courseTitle: TITLE, amount: AMOUNT })),
  measure("examReminderSms (ru)", examReminderSms("ru", { courseTitle: TITLE })),
];

for (const r of [...enforced, ...informational]) {
  const enc = r.gsm ? "GSM  " : "UCS-2";
  console.log(
    `${r.segments === 1 ? "ok  " : "note"} ${r.label.padEnd(26)} ${enc} ` +
      `${String(r.units).padStart(4)}/${r.limit} -> ${r.segments} SMS` +
      (r.offenders.length ? `  non-GSM: ${r.offenders.slice(0, 8).join(" ")}` : ""),
  );
}

const failures = enforced.filter((r) => !r.gsm || r.segments > 1);
if (failures.length > 0) {
  console.error("\nFAIL — these bodies would cost more than one SMS each:");
  for (const r of failures) {
    console.error(
      `  ${r.label}: ${r.segments} segments` +
        (r.offenders.length
          ? `; non-GSM characters ${r.offenders
              .map((c) => `${JSON.stringify(c)} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`)
              .join(", ")}`
          : ""),
    );
  }
  console.error(
    "\nKeep Uzbek bodies inside the GSM set: ASCII apostrophe ' (U+0027), " +
      'straight quotes ", hyphen -. See docs/eskiz-setup.md.',
  );
  process.exit(1);
}
console.log("\nAll enforced bodies are single-segment GSM.");
