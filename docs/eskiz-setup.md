# Eskiz SMS — setup & approved templates

Eskiz **pre-moderates every message body**. An unapproved body is accepted by the
API (200 + a queued id) and then dropped by the operator, so our code records it
as `sent` while nothing reaches the handset. Treat the strings below as a
contract: **editing `lib/notifications/templates.ts` or `lib/auth/otp.ts` without
re-submitting for moderation silently breaks delivery.**

Account: `"MEZON TALIM" MCHJ` · cabinet <https://my.eskiz.uz>

---

## 1. Texts to submit for moderation

Cabinet → **SMS → My texts → + Add text**. Two rules from that page govern the
wording:

- **Clause 1 — no placeholders.** Submit the text exactly as a recipient sees
  it, with real sample values. `(CODE)`, `#NAME#`, `{code}` are all rejected;
  the moderator generalises the variable parts.
- **Clause 2 — authorization codes must name the resource AND the purpose.**
  "Confirmation code: 0000" is rejected; "Confirmation code for login on the
  X website: 0000" is accepted. Operators enforce this, not just Eskiz.

Review takes 1 hour to 1 business day; moderation runs every 3 hours between
10:00 and 16:00 on working days. Statuses: Moderation → In process → Approved
/ Rejected (reason in Notes).

### 1.1 OTP — login  — APPROVED (template id 86318)

Submitted:

```
Mezon Ta'lim (mezontalim.uz) saytiga kirish uchun tasdiqlash kodi: 1234. Kod 5 daqiqa amal qiladi.
```

Approved by the moderator as:

```
Mezon Ta'lim (mezontalim.uz) saytiga kirish uchun tasdiqlash kodi: %d Kod 5 daqiqa amal qiladi.
```

**The `%d` absorbed the full stop after the code.** `%d` matches digits only,
so sending `1234.` would miss the pattern — and a missed pattern is accepted
by the API and dropped by the operator. `otpSms()` therefore emits no full
stop after the code. Changing that string without re-submitting for
moderation breaks delivery silently.

Placeholder syntax, now known: the moderator writes it, using `%d` for
digits (and `%w` for words). You submit literal sample values, never braces.

Resource = `Mezon Ta'lim (mezontalim.uz)`; purpose = `saytiga kirish uchun`.
97 characters — one SMS segment.

Codes are **4 digits** (the norm in UZ). That is only 10 000 combinations, so
`verifyPhoneOtp` burns a code after 5 wrong guesses — without that cap the
verify endpoint is exhaustible inside the 5-minute window. The cap is stored
on `phone_otps.attempts` rather than the shared rate limiter, because that
limiter is fail-open by design.

> Gap: hardcoded Uzbek, no Russian variant unlike the two below. Fine for an
> Uzbek launch; a RU variant needs its own moderation before Russian ships.

### 1.2 Payment confirmation

Source: `paymentConfirmSms()` in `lib/notifications/templates.ts`

```
Mezon Ta'lim: 1 200 000 so'm to'lov qabul qilindi. "AAOIFI Shari'ah standartlari" kursiga yozildingiz.
```
```
Mezon Ta'lim: оплата 1 200 000 сум получена. Вы записаны на «AAOIFI Shari'ah standartlari».
```

### 1.3 Exam reminder

Source: `examReminderSms()` in `lib/notifications/templates.ts`

```
Mezon Ta'lim: "AAOIFI Shari'ah standartlari" kursi imtihonini unutmang.
```
```
Mezon Ta'lim: не забудьте про экзамен по курсу «AAOIFI Shari'ah standartlari».
```

Amounts and course titles above are samples — the moderator turns them into the
variable slots.

---

## 2. API credentials — DONE

The API login is **not** the cabinet login. Cabinet → **SMS → SMS gateway** tab.
They live in `.env` (gitignored, never committed):

```
ESKIZ_EMAIL="<gateway login>"
ESKIZ_PASSWORD="<gateway password>"
ESKIZ_FROM=""          # empty = account default sender; see §3
```

With these unset, `resolveSmsSender()` falls back to `ConsoleSmsSender` and logs
the OTP to the server console — that is how the flow is testable before Eskiz is
live, and why nothing has blocked on this so far.

---

## 3. Sender ID (alfa name)

`4546` is the value pre-selected in the cabinet's Send-SMS form. It is Eskiz's
**test** sender and delivers only their fixed test strings, so it is not a valid
production value for `ESKIZ_FROM` — confirm the correct default with support.

A branded nickname (`MEZON`) is requested under the **Request to Nickname** tab,
carries a per-operator monthly fee, and takes time to approve. Request it in
parallel; ship on the account default.

---

## 4. Consent (legal)

Eskiz contract §4.1.8 — no SMS to a number that has not consented. The landing
form records this: `course_applications.sms_consent_at`, null meaning **no SMS
allowed**. Transactional OTP and payment receipts are not marketing and are
covered by the user's own action; anything promotional must check that column.

---

## 5. Status

Account `"MEZON TALIM" MCHJ` (id 16669) — **active**, balance 305 000 UZS,
`OTP_LOGIN_ENABLED="true"`.

Done:
1. Contract signed; account activated by Eskiz.
2. OTP template 86318 approved (§1.1).
3. Gateway credentials in `.env`; `auth/login` verified against the live API.
4. `ESKIZ_FROM` cleared — it had been left at `4546`, Eskiz's **test** sender,
   which delivers only their fixed test strings. Empty = account default.

Outstanding:
- **No live delivery test yet.** Needs a real `+998` handset; Eskiz does not
  deliver to foreign numbers. This is the only step that proves the whole
  chain (our code → API → operator → phone).
- Nickname `MEZON` not requested. `/nick/me` returns an empty list, so sends
  go from Eskiz's shared shortcode. A branded sender costs a monthly fee per
  operator and takes time — request it in parallel, ship without it.
- §1.2 / §1.3 not submitted; payments and exams are not built yet.

## 6. Encoding & cost (why `npm run check:sms` exists)

The network picks the SMS encoding from the content, not from the sender:

| | limit, 1 segment | limit, per part when split |
|---|---|---|
| **GSM** (Latin, digits, `. , ! ? : ; ' " @ # $ % & ( ) * + - / < = > _`) | 160 | 153 |
| **Unicode** (any character outside that set) | 70 | 67 |

One stray character flips the *entire* message to the 70-character tariff.
`{ } [ ] \ ^ ~ | €` are legal in GSM but bill as two characters each; emoji
bill as two in Unicode.

Current bodies, worst-case sample data:

| Body | Encoding | Units | Segments |
|---|---|---|---|
| `otpSms` (uz) | GSM | 97 / 160 | 1 |
| `paymentConfirmSms` (uz) | GSM | 102 / 160 | 1 |
| `examReminderSms` (uz) | GSM | 71 / 160 | 1 |
| `paymentConfirmSms` (ru) | Unicode | 92 / 70 | 2 |
| `examReminderSms` (ru) | Unicode | 78 / 70 | 2 |

Russian is Cyrillic and therefore always Unicode — two segments is inherent,
not a defect, and these are low-volume transactional messages. The Uzbek
bodies are enforced at one segment by `npm run check:sms`, which fails the
build otherwise.

**The trap.** `Ta'lim` uses an ASCII apostrophe `'` (U+0027). Correct Uzbek
orthography wants `ʻ` (U+02BB), and editors silently turn `'` into `'`
(U+2019). Either substitution moves the OTP to the 70-character limit and
makes this 97-character body **two SMS on every login** — the
highest-volume message on the platform. Same for `«»` in place of `"`, `—`
in place of `-`, and `№` in place of `No`.

---

## 7. Open items

- **OKED mismatch**: the Eskiz contract records `85590`; the company details
  supplied for the site say `70220`. Reconcile with Eskiz.
- Bank details were blank on the contract (Р/С, Bank, МФО) — now known:
  х/р 2020 8000 5074 2666 0001, Ўзмиллийбанк "Себзор амалиёт", МФО 00450.
