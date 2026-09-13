# Authentication — how sign-in and sign-up work

One entry point, two credentials. Phone is the default because it is what the
launch market uses; email + password is the alternative for anyone who prefers
it or who is abroad, where an Uzbek SMS may not arrive.

## The shape of it

There is no separate sign-up flow. With a phone number there cannot be: whether
a number belongs to an account is only knowable *after* its code is checked, and
asking someone to declare up front which one they are just invites them to pick
wrong. `/signup` therefore redirects to `/login`, and the server routes to
"welcome back" or "tell us your name" once it knows.

```
/login
  ├── phone (default)
  │     ① enter number ──► SMS code          sendPhoneCodeAction
  │     ② enter code                         verifyPhoneCodeAction
  │           ├── number known ──────────────► signed in
  │           └── number new ──► ③ name + occupation
  │                                           completePhoneSignupAction
  │                                           ──► account created, signed in
  └── email + password (behind a link)
        ├── sign in                           loginAction
        └── sign up                           signUpAction
```

## Why a phone ticket

Checking an OTP consumes it — single use is the whole point. But step ② has two
possible outcomes, and one of them needs a *second* request (the name). By then
the code is spent, so something else has to vouch for the number.

`lib/auth/phone-ticket.ts` is that something: an HMAC-signed, httpOnly,
ten-minute cookie naming the verified number. The Auth.js `phone-ticket`
provider accepts the ticket, not the code. It is cleared the moment it is spent.

The two alternatives were worse. Re-checking the same code in the second request
means it cannot be single-use. Creating the account at step ② litters the users
table with nameless rows every time someone abandons the form — and a nameless
row is a certificate that prints "—".

## Credentials are additive

`/dashboard/settings` is where an account grows the credential it was not born
with: a phone-first student adds an email and a password, an email-first student
adds a phone. Nothing is mandatory; the point is that neither kind of account is
stuck with one way in.

Setting a *first* password needs no existing password — the session is the
proof. Changing an existing one still requires the current password, so a
borrowed unlocked browser cannot lock the owner out.

## Email verification

An address reaches `users.email` only when its confirmation link is followed.
Until then it lives in `email_verifications` as a claim, so an unverified address
can never squat on the unique `users.email` slot and lock out its real owner, and
the "✓ verified" badge is true by construction rather than by a flag someone has
to remember to set.

Email sign-up is the one exception, and deliberately: there the address *is* the
login credential, so it is written unverified at creation (the account could not
sign in otherwise) and the same link stamps `email_verified` later.

The link targets `/api/verify-email/[token]`, a route handler rather than a page,
because confirming writes to the user row and the JWT session cookie has to be
refreshed to match — and only actions and route handlers may set cookies.

Tokens are stored hashed and are single-use. A spent token whose address is
already on the account reports success rather than an error: mail scanners follow
links before a person sees them, and so does a double-click.

An address that is on the account but unconfirmed gets a **Verify** button on the
settings row. Two situations produce one — an account older than verification
itself, and an email sign-up between creation and the first click — and without
that button the only route to a verified badge was retyping your own address into
a form labelled "change email", which reads like a different operation entirely.

## Where email links point

Every outbound email builds its links from `publicBaseUrl()` (`lib/base-url.ts`):
`AUTH_URL` if set, else the stable production domain Vercel injects as
`VERCEL_PROJECT_PRODUCTION_URL`, else localhost.

That fallback chain matters more than it looks. The rule used to be written out
three times and ended at `http://localhost:3000`, and `AUTH_URL` is not set in
production — so **every** link in **every** email was pointing at localhost:
welcome, receipt, certificate verification, password reset, and address
confirmation. It looks perfectly correct in a server log and is dead in an inbox.

Deliberately not `VERCEL_URL`: that is the per-deployment hostname and changes on
every push, so a link built from it rots as soon as the next deploy lands — and an
emailed link may be clicked weeks later.

## Email delivery is config-gated

`getEmailSender()` returns the Resend sender only when `RESEND_API_KEY` is set;
otherwise it returns `ConsoleEmailSender`, which writes the message to the server
log and returns a fake id. Every send is still recorded in `notifications` as
`sent`, because from the app's point of view it succeeded.

So with no key configured, nothing is broken and nothing is delivered. All six
templates — welcome, verification, password reset, receipt, certificate, and the
instructor digest — are in this state until the key exists.

## Rate limits

Every one of these was absent before the rework.

| Action | Per identity | Per IP |
|---|---|---|
| Send OTP | 5 / 15 min | 20 / hour |
| Verify OTP | 15 / 15 min | — |
| Email + password login | 10 / 15 min | 50 / 15 min |
| Email sign-up | — | 10 / hour |
| Password reset request | 5 / hour | 20 / hour |
| Email claim / resend | 5 / hour each | — |

The per-IP OTP limit is the commercially important one: every send costs real
money on a prepaid Eskiz balance, and the 60-second per-number cooldown inside
`requestPhoneOtp` would happily let one source spend the balance across ten
thousand different numbers.

Separately, a code is burned after 5 wrong guesses (`phone_otps.attempts`). A
4-digit code is only 10 000 combinations, which is walkable inside its 5-minute
life. That cap is deliberately **not** built on `checkRateLimit`, which is
documented fail-open — a limiter that opens under database trouble is no defence
here.

## Phone number format

`phoneSchema` normalises to E.164 before anything else looks at the value:
`90 123 45 67`, `(90) 123-45-67`, `998901234567` and `+998 90 123 45 67` all
become `+998901234567`. The number is the account's unique key, so accepting two
spellings as two accounts would be worse than rejecting either. Display groups it
back into `+998 90 123 45 67`.

## Tests

`tests/e2e/phone-auth.spec.ts` and `tests/e2e/email-verify.spec.ts` cover both
credentials end to end. It seeds a known code
straight into `phone_otps` rather than reading a live one back from anywhere —
the real hashed, single-use, time-boxed verification path stays under test
without adding a way to read codes, which would be worth more to an attacker than
the test is worth to us. Seeding also survives the resend cooldown, which leaves
the seeded code in place.

The email suite seeds tokens the same way and for the same reason — the row holds
only a SHA-256, so there is nothing to read back. It covers the Verify button on
an unconfirmed address, the confirm path, a spent link reporting success rather
than an error, and the invariant that an unconfirmed address never reaches
`users.email`.
