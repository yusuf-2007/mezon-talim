---
target: landing page
total_score: 27
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
timestamp: 2026-08-17T17-28-07Z
slug: app-locale-page-tsx
---
⚠️ DEGRADED: single-context (both isolated sub-agents terminated on a monthly spend limit before returning output)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Form has real pending/success states; "Kutish ro'yxatiga yozilish" is a dead link styled as a button |
| 2 | Match System / Real World | 4 | Fluent professional Uzbek, domain terms correct, no jargon leakage |
| 3 | User Control and Freedom | 2 | After submit the form is replaced by a success card with no way back; a mistyped number is unrecoverable |
| 4 | Consistency and Standards | 3 | Internally coherent, but 19 distinct ad-hoc font sizes and a second design system elsewhere in the repo |
| 5 | Error Prevention | 2 | Phone format only hinted via placeholder, no mask; unticked SMS consent silently means phone-only |
| 6 | Recognition Rather Than Recall | 3 | Everything visible; anchor nav has no active state |
| 7 | Flexibility and Efficiency | n/a | Persuade surface — single linear path is correct |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely restrained; hairline structure and alternating grounds do real work |
| 9 | Error Recovery | 3 | Errors inline, translated, preserve input |
| 10 | Help and Documentation | 3 | Six real objections in FAQ; nothing contextual at the form |
| **Total** | | **27/36** | **Good (75%)** |

## Design Specificity Verdict

Authored, not interchangeable. Four elements could not be lifted into another product: the AAOIFI→Kengashi→Ta'lim status chain, the two-certificate split with its "alohida hujjatlar" divider, the language-bridge section, and the placeholder tokens. Asymmetric 1.1fr/0.9fr hero and hairline data strip resist the centred-hero-plus-three-cards default.

Drift toward category-generic: the three-instructor row and two-card testimonial grid are conventional.

Deterministic scan: 68 findings, all `design-system-font-size` (advisory), across all 16 landing components. apply-form.tsx (11), course-section.tsx (9), testimonials.tsx (6). True positives: implementing the comp 1:1 produced 19 distinct font sizes (0.78–1.65rem) against 7 documented type roles. No real ramp. Zero findings of any other rule.

Visual overlays: not attempted (spend-limit failure ended the browser-injection path).

## Overall Impression

Converts better than most B2B education pages; the honesty is doing the persuasion. Biggest opportunity is the empty rectangle above the fold — the largest hero element is a photo placeholder.

## What's Working

1. The language-bridge section — answers the sale-killing objection in three concrete rows before the visitor raises it.
2. The two-certificate split — a legal necessity turned into a design feature.
3. Restraint as credibility — no countdown, scarcity badge, or carousel, for an audience trained to discount overstatement.

## Priority Issues

**[P1] Every section eyebrow fails WCAG AA contrast.** Gold Deep #c08e00 on white = 2.95:1; on wash = 2.72:1. Required 4.5:1 (0.74rem uppercase, below large-text threshold). Affects every section. DESIGN.md's "Eyebrow-Before-Headline Rule" mandates it. Fix: darken to ~#8a5b00 (5.63:1) and update the rule. → /impeccable audit

**[P1] The hero's largest element is empty.** Photo slot occupies the whole right column above the fold. Fix: Mezon owes 5–7 offline-class frames; until then consider collapsing the hero to one column. → /impeccable layout

**[P1] A contradicted date is published as fact.** "8-avgust — 15-noyabr"; 8 Aug + 15 weeks = 21 Nov. Every other unsupplied fact is bracketed. Fix: convert to [OQIM SANALARI]. → /impeccable clarify

**[P2] Three controls that look interactive and do nothing.** Waitlist anchor → #ariza; both Telegram links href="#"; BIM "Batafsil" → #ariza. → /impeccable harden

**[P2] Touch targets below 44px on mobile.** Nine at 390px. Worst: SMS-consent checkbox 16×16 (legally load-bearing), burger 40×40, five footer links 22px tall. → /impeccable adapt

## Persona Red Flags

**Jordan (first-timer):** No price; [NARX] reads as a defect. Status chain assumes AAOIFI knowledge; first text on page is 2.95:1 uppercase.

**Riley (stress tester):** Double submit → dedupe returns success silently. Wrong number → no path back. FAQ summary shows only default outline; name input focus resolved to `none 3px` with no box-shadow.

**Casey (mobile):** Primary CTA at top of a 14,400px page. 16×16 consent checkbox. No form-state preservation on interruption.

**"Nodira" (bank compliance officer):** Certificate recognition answered well. Price, contact, and legal requisites all absent — cannot start internal approval. Highest-value gap, blocked on Mezon not code.

## Minor Observations

- #aaoifi is a nav target with no heading; every other section has an h2.
- Heading outline otherwise clean: one h1, no skipped levels.
- Muted #8a97a6 fails 2.98:1 on white; footer faint #5e7a96 fails 3.78:1 on navy-deep; placeholder text 2.10:1.
- No horizontal overflow at 1440/980/620/390. No console or page errors.
- On-navy dim passes at 4.71:1 — barely.
- Anchor nav has no active/current state.

## Questions to Consider

- If price can't be published, what is the smallest qualifying signal that lets Nodira start internal approval?
- 14,400px tall on mobile with one CTA at top — what would a persistent mobile action bar cost in restraint?
- Three credibility sections precede the course description. Right order for a professional who already knows the market is opening?
