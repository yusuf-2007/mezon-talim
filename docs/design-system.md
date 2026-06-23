# Mezon Ta'lim — Design System

Derived from the real logo (open-book mark, navy + gold) and the team's Section A
answers. **Light interface, formal-academic with warmth, modern/serious, minimalist.**
References: Coursera (polish/cards), Marifa (course page), Taif (trust + hero pattern).

---

## 1. Brand colours

Pulled directly from the logo SVGs. Navy and gold are the two anchors; a few derived
tints/shades give variety (per A1/A2).

| Token | Hex | Use |
|---|---|---|
| `navy-900` | `#033668` | darkest navy, hero backgrounds |
| `navy-800` | `#023A69` | **primary brand navy** (logo) — headings, structure |
| `navy-600` | `#0A4E8A` | derived — links, hovers |
| `navy-100` | `#E7EEF6` | derived tint — surfaces, selected states |
| `gold-500` | `#F8B801` | **primary gold** (logo) — CTAs, accents |
| `gold-400` | `#F0B720` | derived — hover on gold |
| `gold-100` | `#FDF1CC` | derived tint — badges, highlight backgrounds |
| `ink` | `#1A2230` | body text (near-black, slightly warm) |
| `slate-500` | `#5B6B7F` | secondary text |
| `line` | `#E2E8F0` | borders / dividers |
| `surface` | `#FFFFFF` | cards |
| `bg` | `#F7F9FC` | page background (soft, not pure white) |
| `success` | `#1E9E6A` | pass states |
| `danger` | `#D14343` | fail / destructive |

**Pattern (the key move):** a **navy hero band with a gold primary CTA**, then **light
content below** — this reconciles "light interface" (A9) with a strong branded hero, and
matches the logo exactly. It's Taif's structure in Mezon's colours. Gold is for primary
actions only; don't flood the page with it (A12 "subtle").

Use the **logo's reversed/white lockups** on navy backgrounds, full-colour on light.

---

## 2. Typography

Fonts must support **Uzbek Latin** (oʻ, gʻ, sh, ch) **and Cyrillic** (Russian). No Arabic.
Team is open to new typography (A3).

- **Body / UI:** **Inter** — excellent Latin-extended + Cyrillic coverage, clean, modern.
- **Headings:** recommend a serious but warm option, two candidates:
  - **All-sans** (Inter or **Manrope** for headings) → cleaner, more "Coursera-modern".
  - **Sans + serif** (Inter body + **Source Serif 4** or **Lora** headings, both Cyrillic-
    capable) → more "academic gravitas," matches the formal-academic brief.
- **Numerals:** tabular for prices/scores.
- **Scale:** modular ~1.25. Generous line-height (1.5–1.6) for long-form lesson text.

> Final type choice is a design-phase decision; default to **Inter (body) + Source Serif 4
> (headings)** unless the team prefers all-sans.

---

## 3. Core UI conventions

- **Radius:** medium (8–12px) cards/buttons — friendly but serious.
- **Shadows:** soft, low — flat-ish, not heavy.
- **Spacing:** generous whitespace (Coursera-level); don't crowd.
- **Buttons:** primary = gold bg / navy text; secondary = navy outline; tertiary = ghost.
- **Cards:** white surface, 1px `line` border, subtle shadow on hover.
- **Motion:** subtle and professional (A12) — short fades/slides, no bounce/parody.
- **Imagery:** real photography supplied by Mezon (A10); minimal Islamic motifs, subtle
  geometric accents only (A4) — never heavy ornamentation.
- **Components:** build on **shadcn/ui**, themed to the tokens above.

---

## 4. Page blueprints (MVP)

### Landing  *(Taif structure, Mezon colours)*
Navy hero band: headline ("Learn the AAOIFI Shari'ah Standards — in Uzbek"), subcopy,
**dual CTA** (gold "Browse courses" + outline "About AAOIFI"), supporting image/video on
the right → **AAOIFI affiliation / trust band** (partner logos) → value-prop grid (in
Uzbek, video-first, certificate-backed) → **course rail** (cards) → credibility stats →
FAQ → footer.

### Course catalog
Grid of **course cards** (Coursera-compact + Taif-rich): cover, title, short summary,
lessons/quizzes count, price (or "Free preview"), rating later. Filters by topic/level.

### Course detail  *(Marifa layout, modern execution)*
Photographic hero with title + instructor → tabbed body (Overview / Curriculum / FAQ) →
**curriculum accordion** (modules → lessons, lock icons, "Preview" pill on free lessons) →
**sticky right enroll card**: price, "Course includes — N lessons / N quizzes /
Certificate", access duration, **Enroll** (gold) → Click/Payme checkout.

### Course player  *(Coursera-style)*
Left **sidebar curriculum** with progress checkmarks + sequential lock → main **Bunny
video** (view-only, speed control, subtitles) → under it: tabs for **Notes**, **Glossary**,
**Lesson text**, and the **per-lesson quiz + 1–5 self-assessment** → "Next lesson" gated on
completion.

### Exam UI
Pre-exam screen (rules: time limit, attempts left, cooldown) → timed question runner
(one/many per page, countdown) → result (score, pass/fail) → **answer review** with
explanations (after passing) → mock mode unscored.

### Certificate + verification
Student certificate page (view/download own PDF) + **public `/verify/:code`** page showing
name, course, date, valid/revoked only.

### Dashboard (student)
"My courses" with progress, continue-where-you-left-off, certificates earned, exam status.

### Studio (teacher) & Admin/Accountant
Studio: course/module/lesson/assessment authoring, Bunny upload, publish. Admin: users,
courses, payments, analytics dashboard (sales, enrollments, completion). Accountant:
finance/reports views.

---

## 5. Localization & a11y

- All copy via **next-intl**; UZ default, RU ready. Language switcher in header/footer.
- Don't bake text into images.
- WCAG AA contrast (navy/gold pairings: gold bg needs navy text, not white).
- Keyboard-navigable player and exam UI.
