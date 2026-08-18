# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** working bank and finance professionals in Uzbekistan. Busy, demanding
adults evaluating a serious, expensive professional credential; time is their binding
constraint. 100+ expected in the first CPSS cohort.

**Secondary:** entrepreneurs (the BIM course — "is my money halal?"), employers sending
staff (banks and Islamic "windows" — the priority B2B segment), plus students, lawyers,
and researchers. Diaspora is untested as a segment.

**Starting knowledge is two different populations.** BIM students start from zero and
need no prior knowledge. CPSS students have finance-sector experience but no systematic
grounding in the AAOIFI standards.

**The largest open uncertainty about this audience is English proficiency** — it has never
been measured, and the exam is in English. Everything the language bridge does rests on an
unmeasured assumption.

**What they are actually buying:** the ability to act with confidence. Knowledge is the
delivery mechanism, not the product. The entrepreneur wants certainty ("is my money
halal?"); the professional wants recognized standing in a fast-growing market.

*Unknown:* age range and city distribution (including the Tashkent share).

**Platform roles:** student, teacher, super admin, accountant. Single organization, no
multi-tenancy; authorization is enforced in the app layer, not via DB row-level security.

## Product Purpose

Mezon Ta'lim teaches Islamic finance in **Uzbek** — practical, not dry theory — and
prepares students for AAOIFI's international certifications.

There are two distinct offerings, and they are **not the same system**:

1. **AAOIFI CPSS preparation course** — taught live by instructors, cohort-based, sold
   consultatively. It does **not** run inside the LMS. `mezontalim.uz` is lead capture
   for it: the primary CTA is "Ariza qoldirish" (request a consultation), never "buy now".
2. **The LMS platform** — self-paced online courses (e.g. *Biznesda Islom moliyasi*),
   with video lessons, sequential unlock, progress and resume, notes, bookmarks, a
   glossary, quizzes and exams, and an auto-generated completion certificate with a
   public verification page.

Success means a qualified lead pipeline for CPSS cohorts, and self-serve enrolment
through to completion for platform courses.

## Positioning

The exact, mandatory formulation:

> Mezon Ta'lim — AAOIFI ning O'zbekistondagi rasmiy vakili bo'lgan Mezon Kengashining
> ta'lim markazi.

(Mezon Ta'lim is the education centre of Mezon Kengashi, which is AAOIFI's official
representative in Uzbekistan.) Shortening this to "Mezon Ta'lim is AAOIFI's official
representative" is forbidden — it falsely implies direct AAOIFI accreditation.

The value chain: **AAOIFI** (the standard) → **Mezon Kengashi** (practice: audits,
Shari'ah board seats) → **Mezon Ta'lim** (knowledge).

Three things a neighbouring product cannot truthfully copy:

1. **Applied practice.** Competitors can buy the standard and read it. Mezon Kengashi has
   *applied* it in Uzbekistan — running audits, sitting on the Shari'ah board — so the
   teaching examples come from delivered projects, not textbooks.
2. **Religious authority in-house.** The body that can answer "is this genuinely halal?"
   is our own owner. Neither of the two named domestic alternatives has that.
3. **A translation mandate.** There is a contract to translate the AAOIFI Shari'ah
   standards into Uzbek.

**Ambition:** to be *the standard* — the single authorized AAOIFI preparation and
certification centre in Uzbekistan.

**Internal targets that must never appear on the site:** revenue goal of ~3.2bn UZS by
August 2027; a baseline of 185 students in the AAOIFI track. These are planning figures,
not public claims.

## Operating Context

- **CPSS course:** 30 lessons / 15 weeks / 2 lessons per week / ~3h each ≈ 90 hours.
  70% online, 30% offline, designed around a working schedule. Taught in Uzbek, covering
  AAOIFI's 58 Shari'ah standards. 5 curators at ~20 students each; weekly quizzes, mock
  exams, bilingual terminology glossary.
- **BIM course** (*Biznesda Islom moliyasi*): 12 lessons, 1.5–2 months, no prior knowledge
  required. Several cohorts already run (BIM-5 = fifth).
- **Exam language reality:** the AAOIFI CPSS exam is currently administered only in English
  and Arabic, while lessons are in Uzbek. This must be stated openly and answered with the
  in-programme "language bridge" (bilingual terminology, practice with exam-language
  question wording, a language-level check at course start). It is a selling point, not a
  thing to hide.
- **Market conditions:** the Islamic finance law took effect 29.06.2026, requiring banks to
  comply with AAOIFI standards. Portfolio growth ~$7M (2025) → ~$32M (first 5 months of
  2026). Roadmap: at least one Islamic "window" by end-2026, independent Islamic banks by
  2030. Acute staffing shortage — banks are opening windows without staff who understand
  Shari'ah-compliant products.
- **Acquisition funnel (current, proven):** Telegram is the primary channel — course
  announcements have always gone out there. The path is *Telegram message → short
  consultation → reserve a place*. Webinars have been run and work. Direct B2B outreach to
  banks is the third channel.
- **Courses run in cohorts**, not continuous open enrolment — hence the need for a next-
  cohort date and a waiting list rather than an always-on checkout.
- **SMS:** Eskiz contract №1830-2026 obliges Mezon to obtain **and register** prior
  subscriber consent before sending any SMS (§4.1.8), with a 30 BRV penalty for sending
  without it (§5.5). Consent capture and its timestamp are a legal requirement, not a
  courtesy.
- **Future courses under discussion:** CIPA, CSAA, CPFAS (the rest of the AAOIFI family).
  Which and when is unconfirmed.

## Capabilities and Constraints

- **Data localization (legal, non-negotiable).** Under Uzbek Law "On Personal Data"
  No. ZRU-547 (Art. 27-1), personal data of Uzbek citizens must be stored on servers
  physically inside Uzbekistan. Only non-personal content may live abroad: Bunny.net
  (video) and email delivery. *Current gap: the development database is Neon in
  `us-east-1`; production must run in-country (PS Cloud, Tashkent).*
- Money is stored as integer **tiyin** (UZS × 100). Never floats.
- Video is **view-only** — no downloads.
- Enrollment is created only on a **verified provider callback**, never from the client.
- **Certificates are two separate documents and must never be blurred:** AAOIFI awards the
  CPSS credential through its own exam; Mezon Ta'lim issues its own course-completion
  certificate (auto PDF, stored in MinIO, with a public verification page).
- **Payment model (confirmed):** split by course. CPSS is **consultative** — lead capture,
  qualification, then payment by Click/Payme or corporate invoice. BIM is **self-serve**
  checkout. The schema already supports both (`courses.price_tiyin`,
  `access_duration_days`, enrollment `expires_at`).
- **Corporate invoicing is mandatory, not optional.** Bank employees are the primary
  audience and their employers pay; without an invoice path that whole segment is closed.

**Explicitly open decisions** — record, do not invent. Listed roughly in the order the
team itself prioritized them:

1. **CPSS price and instalment terms.** Unknown. *Internal reference only:* the BIM
   average cheque has been discussed at ~7.2M UZS. Not a CPSS price, not for publication.
2. **Refund / guarantee policy.** Must be written *before* it goes on the site — it is
   directly entangled with the "we prepare you" promise.
3. **Legal requisites and contacts** (MCHJ name, STIR, address, bank account, phone,
   email). Click and Payme cannot be connected without them.
4. **Total BIM graduate count.** The team's own assessment: their strongest number, and
   currently unstated anywhere. Seven testimonials without a "how many studied" figure is
   weaker than the two together.
5. **Photography.** Three instructor portraits plus 5–7 frames from an offline class.
   Testimonial photos already exist and are of usable quality.
6. **Cohort dates.** *Known conflict:* 8 August + 15 weeks = 21 November, but the team
   wrote mid-November. One date must be settled before publication.
7. **Depth of standards coverage.** 58 standards across ~90 hours is ~1.5h each, less once
   language-bridge time is taken out. Before the site claims to cover all 58, decide
   internally which are taught deeply and which are surveyed. The promise must be real.
8. **Final package contents** — whether video recordings persist, what exam-registration
   help is included.
9. **Content sign-off:** who formally reviews course content — the Mezon Kengashi Shari'ah
   board? Is there a written sign-off?
10. **AAOIFI exam registration:** can Mezon Kengashi register candidates as representative,
    and is there a discount?
11. **Written permission** to use the AAOIFI logo; and to publish testimonial names and
    photographs (especially the three tier-1 speakers).
12. Licensing status as a non-state educational institution.
13. Telegram integration depth; exam proctoring depth; whether live sessions are integrated
    or built in-house.
14. Recommended self-study hours per week, beyond the 6 hours of class.

## Brand Commitments

- **Name:** Mezon Ta'lim. Legal entity "MEZON TALIM" MCHJ, INN 312837976; director
  Akramov Muxtor Mutalli o'g'li.
- **Logo:** open-book mark — left page navy, right page gold; wordmark MEZON (navy) +
  TA'LIM (gold). Asset at `public/brand/mezon-logo-horizontal.png`.
- **Voice:** *ishonchli, professional, amaliy* (trustworthy, professional, practical);
  also *nufuzli, aniq, halol* (prestigious, precise, honest). Never *arzon, oson, tez*
  (cheap, easy, fast). No "become an expert in 3 days" energy — the entire value is
  seriousness.
- **No Arabic script in the UI.** Typography must carry Uzbek Latin (oʻ, gʻ) and Cyrillic.
- **Locales:** Uzbek and Russian are committed for launch. English exists in the codebase
  as a UI convenience and is **not** a promised locale.
- **Slogan — not yet confirmed.** The line that has demonstrably worked so far is
  *"Endi o'zbek tilida"* (Now in Uzbek). The proposed replacement,
  *"Standart — xalqaro. Til — o'zimizniki."*, is a proposal awaiting sign-off, not an
  approved asset.
- **Religious greeting:** recommended not in the hero, but natural in Telegram and email.
  The audience is mixed (bank employees + entrepreneurs). Undecided.
- **Terminology needs an internal style guide** — the spelling of "Shariat standartlari"
  and of murabaha / ijara / mudaraba, to ship alongside the bilingual glossary.

**Absolute prohibitions** (legal/reputational — never violate):

- Never promise or guarantee an exam pass, in any form. Only "imtihonga tayyorlaymiz".
- Never state a date for an Uzbek-language AAOIFI exam.
- Never present Mezon's certificate as AAOIFI's.
- Never imply direct AAOIFI accreditation of the programme.
- Never name or criticize competitors.
- No fatwa-level religious rulings — that is Mezon Kengashi's authority, not marketing's.

## Evidence on Hand

**Real and usable:**

- **Graduate testimonials — all from the BIM (entrepreneurs) course.** Every one must
  carry the label "Biznesda Islom moliyasi kursi bitiruvchisi"; no CPSS graduates exist
  yet, because the first cohort has not finished. Tier 1: Akmal Mirzabayev (*Hesap*),
  Akbarbek Mustaqimov (*Hisobchilar Uyushmasi*), Bahodir Akbarov (*Defast Cargo
  Logistics*). Tier 2: Azizov A., Odilov D., Sulxiya G., Oybek M.
- **Instructor credentials:** Muxtorjon Akramov (director & lead trainer, AAOIFI CPSS
  holder), Muzaffar Xusnidinov (director of Mezon Kengashi; CSAA, CAP, MBA), Xondamir
  Nusratxo'jayev (AAOIFI Financial Council member 2016–2023, co-author of AAOIFI
  accounting standards).
- Market statistics above, attributed to Uzbek legislation and Central Bank data. Each
  figure should be re-verified against its source before publication — a stale number
  damages trust more than a missing one.
- **Testimonial photographs already exist** and are of usable quality.
- **Existing written material held by the team, not yet handed to design:** the final
  edited CPSS advertising post, the company passport, brand passport v2.0, and the B2B
  offer.
- Source files in this repo: `docs/LANDING-DESIGN-MASTERPROMPT.md` (brief),
  `docs/design/landing-cpss.dc.html` (approved landing design),
  `Mezon-Talim-Landing-Javoblar-Qoralama.md.docx` (the underlying Q&A this is drawn from).
- `mezontalim.uz` is live. Who administers it is unrecorded.

**Absent — must not be fabricated:**

CPSS price · cohort start dates · phone, email, physical address · full bank requisites ·
instructor and classroom photography · promo video · refund policy · Telegram channel URL
and follower counts · total BIM graduate count · media coverage · licences · a documented
success story · partner and bank logos · written permission to display the AAOIFI logo ·
written permission to publish testimonial names and photographs.

**No CPSS testimonials exist yet.** At least two are needed once the first cohort
finishes; until then every quote on site must be labelled as a BIM graduate.

## Product Principles

1. **State the credential chain precisely.** Every claim about AAOIFI, Mezon Kengashi, and
   Mezon Ta'lim must survive a lawyer reading it. The precision *is* the brand.
2. **Sell preparation, never outcomes.** We prepare people for an exam we do not
   administer and cannot grade.
3. **Name the hard truths and answer them.** The exam is not in Uzbek — say so, then show
   the bridge. Hiding an objection loses a professional audience.
4. **Personal data stays in-country.** A legal obligation with penalties, not an
   implementation detail to optimize away.
5. **Built for people who have jobs.** The primary user is a working professional; their
   scarcest resource is time, and every format decision follows from that.

## Accessibility & Inclusion

- WCAG AA contrast. Gold backgrounds require navy or dark text — never white.
- Typography must support Uzbek Latin (oʻ, gʻ, sh, ch) and Cyrillic for Russian.
- The audience is working professionals on mixed devices, frequently mobile; mobile is a
  first-class target, not a fallback.
