---
name: Mezon Ta'lim
description: The measured standard — AAOIFI Shari'ah education in Uzbek, rendered with institutional precision.
colors:
  institutional-navy: "#023a69"
  navy-deep: "#011e38"
  navy-mid: "#0b4c82"
  navy-dark: "#012a4d"
  certificate-gold: "#f8b801"
  gold-light: "#fbd968"
  gold-deep: "#c08e00"
  gold-ink: "#8a5b00"
  gold-tint: "#fef3d2"
  gold-wash: "#fffaec"
  gold-line: "#e8d9a8"
  cream: "#fffcf4"
  ink: "#0e2233"
  slate: "#46586b"
  muted: "#8a97a6"
  muted-light: "#a9b4c0"
  on-navy: "#c6d6e6"
  on-navy-dim: "#8fa8c0"
  on-navy-faint: "#5e7a96"
  line: "#e2e7ee"
  line-soft: "#eff2f6"
  line-strong: "#dce3ec"
  wash: "#f3f6fa"
  wash-alt: "#f7f9fb"
  tint: "#e7eef4"
  surface: "#ffffff"
  danger: "#d14343"
  success: "#1e9e6a"
typography:
  display:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "clamp(2.3rem, 5vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  quote:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "clamp(1.4rem, 3vw, 2.05rem)"
    fontWeight: 500
    lineHeight: 1.36
    letterSpacing: "normal"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.16em"
  datum:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "normal"
  # The nine working steps below the display roles. The first implementation
  # carried 19 distinct sizes copied from the comp, several differing by less
  # than half a pixel; they were merged onto these steps with no visible change.
  # Added for the dashboards: the rail's group labels and the ADMIN chip sit
  # below every landing-page step. The handoff's .6/.66 pair differ by 1px, so
  # they share one step, as the nine below already merged their near-duplicates.
  ui-2xs:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.16em"
  ui-xs:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  ui-sm:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  ui-md:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  ui-lg:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  ui-nav:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  ui-xl:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  title-sm:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  title-md:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  # Dashboard steps. The handoff's scale (card title 1.2-1.3, h1 1.75-1.9, big
  # number 1.9-2.4) sits between the landing roles; these are the three that
  # recur across the student and admin views. Everything within a pixel of an
  # existing step uses that step instead.
  title-card:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  datum-sm:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.9rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "normal"
  datum-lg:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "2.1rem"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "normal"
  title-lg:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "1.65rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  xs: "6px"
  sm: "9px"
  field: "10px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "26px"
  lg: "44px"
  xl: "88px"
  gutter: "24px"
  container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.certificate-gold}"
    textColor: "{colors.navy-deep}"
    rounded: "{rounded.md}"
    padding: "15px 28px"
  button-primary-hover:
    backgroundColor: "{colors.certificate-gold}"
    textColor: "{colors.navy-deep}"
  button-outline-on-navy:
    backgroundColor: "rgb(255 255 255 / 0.07)"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px 26px"
  button-outline-on-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.institutional-navy}"
    rounded: "{rounded.sm}"
    padding: "12px 22px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "28px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  eyebrow:
    textColor: "{colors.gold-deep}"
    typography: "{typography.label}"
  chip:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.institutional-navy}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  placeholder-token:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.xs}"
    padding: "5px 12px"
---

# Design System: Mezon Ta'lim

## Overview

**Creative North Star: "The Mizan"**

*Mezon* — mīzān — is the balance: the scale by which a thing is measured and found
sound. The name is not decoration, it is the design brief. This system behaves like a
precision instrument: everything is aligned to something, nothing is placed for
atmosphere, and weight is distributed on purpose. Hairlines do the work that boxes would
do in a lesser system. Where another education brand would reach for enthusiasm, this one
reaches for exactness, because the product's entire claim is that its examples come from
audits actually performed and standards actually applied.

The register is institutional but not cold. Spectral gives the headings the authority of a
printed record; Manrope keeps the working text plain and current. Navy carries the
structure and gold marks only what has been attested or what the visitor should do next.
Density is generous — this is read by working professionals deciding whether to spend real
money and fifteen weeks, and crowding the page reads as pressure.

Restraint here is a credibility strategy, not a taste preference. The audience includes
compliance-minded bank staff who are professionally trained to distrust overstatement. A
page that oversells is a page they discount.

**Key Characteristics:**

- Serif authority over sans-serif working text — a printed-record voice
- Hairline rules and tonal washes instead of boxes and fills
- Gold is rare and load-bearing; navy is the ground
- Unresolved facts are shown as visible bracketed tokens, never quietly invented
- Alignment is exact; optical drift is a defect, not a style

## Colors

A two-colour brand on a cool neutral field: navy holds the structure, gold attests.

### Primary

- **Institutional Navy** (`#023a69`): The structural authority colour. Full-bleed section
  bands, every heading, chain nodes, and the active state of controls. It is the ground the
  system stands on, not an accent.
- **Navy Deep** (`#011e38`): The footer plane and, critically, the text colour on gold —
  gold never carries white text.
- **Navy Mid** (`#0b4c82`): Links, avatar chips, and the hero's radial lift. The one place
  navy becomes atmospheric rather than structural.
- **Navy Dark** (`#012a4d`): Backdrop behind photography and photo slots, so an image and
  its empty state occupy the same visual weight.

### Secondary

- **Certificate Gold** (`#f8b801`): Reserved for the single primary action and for
  credential moments. On a landing section it appears at most twice.
- **Gold Light** (`#fbd968`): Eyebrow labels and small type *on navy only* — it exists
  because Certificate Gold fails contrast as small text on a dark field.
- **Gold Deep** (`#c08e00`): Eyebrow labels on light backgrounds; the light-field twin of
  Gold Light.
- **Gold Ink** (`#8a5b00`) on **Gold Wash** (`#fffaec`) with a **Gold Line** (`#e8d9a8`)
  hairline: the placeholder-token treatment for facts not yet supplied.
- **Cream** (`#fffcf4`): Fills exactly one element — the highlighted node in the AAOIFI
  status chain.

### Neutral

- **Ink** (`#0e2233`): Body text at full strength.
- **Slate** (`#46586b`): Secondary prose, descriptions, list bodies.
- **Muted** (`#8a97a6`) / **Muted Light** (`#a9b4c0`): Tertiary metadata and input
  placeholders.
- **On Navy** (`#c6d6e6`) / **On Navy Dim** (`#8fa8c0`) / **On Navy Faint** (`#5e7a96`):
  The three-step text ramp for dark bands. Never reuse the light-field greys on navy.
- **Line** (`#e2e7ee`) / **Line Soft** (`#eff2f6`) / **Line Strong** (`#dce3ec`): Section
  edges, inner dividers, and data-strip separators respectively.
- **Wash** (`#f3f6fa`) / **Wash Alt** (`#f7f9fb`) / **Tint** (`#e7eef4`): The alternating
  section grounds and navy-tinted chip fill.

### Named Rules

**The Attestation Rule.** Gold marks two things only: the action you want taken, and a
credential that has been earned. It is never used to make a section look livelier. If a
screen has more than two gold elements, one of them is decoration and should be removed.

**The Never-White-On-Gold Rule.** Certificate Gold carries Navy Deep text, always. White on
`#f8b801` fails WCAG AA and is the single most likely accessibility regression in this
palette.

**The Two-Ramp Rule.** Light fields and navy fields have separate text ramps. Reaching for
Slate on navy, or On-Navy-Dim on white, is always wrong.

## Typography

**Display Font:** Spectral (with Georgia, serif)
**Body Font:** Manrope (with system-ui, sans-serif)

**Character:** Spectral is a serif with enough contrast to feel authored and enough
restraint to stay professional — it reads as a document, not a magazine. Manrope beneath it
is geometric and unfussy, so specifications, tables, and form labels stay legible at small
sizes. Both carry Latin Extended (oʻ, gʻ) and Cyrillic, so Russian is data entry and never
a typographic refit.

### Hierarchy

- **Display** (600, `clamp(2.3rem, 5vw, 4rem)`, 1.03, `-0.025em`): One per page, the hero
  proposition. The tight leading is deliberate — the headline should read as a single mass.
- **Headline** (600, `clamp(1.9rem, 3.4vw, 2.6rem)`, 1.14, `-0.015em`): Section openers,
  always preceded by an eyebrow label.
- **Title** (600, 1.3–1.65rem, 1.25): Card and instructor names.
- **Quote** (500 italic, `clamp(1.4rem, 3vw, 2.05rem)`, 1.36): Testimonials. Italic Spectral
  is the system's only italic — it means "someone said this".
- **Body** (400, 0.92–1.08rem, 1.5–1.65): Working prose, capped at 46–56ch for lead
  paragraphs and 70ch for answers.
- **Label** (700, 0.74rem, `0.16em`, uppercase): Eyebrows and metadata. The wide tracking is
  what makes a three-word label read as a system element rather than shouting.
- **Datum** (600, 2rem, 1.05): Large figures in the market-data strip. Spectral, not
  Manrope — numbers are presented as findings, not as UI.

### Named Rules

**The Eyebrow-Before-Headline Rule.** Every section headline is preceded by a Label-styled
eyebrow in Gold Deep. It is the system's paragraph mark: it tells the scanning reader a new
argument has started.

**The One Italic Rule.** Italic Spectral is reserved for quoted human speech and the hero
tagline. Nothing else in the system is italic.

## Layout

A single centred column of `1200px` maximum with a `24px` gutter, narrowing to `900px` for
pull-quotes and `860px` for the FAQ, where line length matters more than width.

Vertical rhythm is carried by full-bleed alternating sections: white, then Wash
(`#f3f6fa`), then a navy band, each separated by a `1px` Line rule. The alternation is the
page's structure — a reader can tell where they are by the ground colour alone. Section
padding is `88px` vertical on desktop, `60px` below `980px`.

Two breakpoints govern the marketing surface: **980px**, where every multi-column grid
collapses to one column and the navigation becomes a burger; and **620px**, where the
remaining two-column data grids and quote strips go single-file. The application surface
uses the standard Tailwind steps (640/768/1024). Content grids are asymmetric by intent —
`1.1fr 0.9fr` for the hero, `1fr auto 1fr` for the certificate pair — because symmetric
halves read as a template.

**The Hairline Rule.** Structure is expressed with 1px rules and background changes before
it is expressed with borders and boxes. A bordered box inside a bordered section is one
box too many.

## Elevation & Depth

The system is layered: shadows carry hierarchy rather than merely decorating hover. Depth
is tinted, never neutral — every shadow is a navy shadow (`rgb(2 58 105 / …)` on light
grounds, `rgb(1 20 40 / …)` over dark ones), so elevation reads as part of the palette
instead of grey haze laid on top of it. Gold elements carry a gold-tinted glow, which is
what makes a primary action feel lit rather than merely raised.

### Shadow Vocabulary

- **Rest** (`box-shadow: 0 2px 10px rgb(2 58 105 / 0.05)`): Content cards sitting on a
  wash. Barely present; it separates, it does not lift.
- **Raised** (`box-shadow: 0 6px 24px rgb(2 58 105 / 0.09)`): The lead-capture form and any
  panel that is the point of its section.
- **Hover Lift** (`box-shadow: 0 14px 32px rgb(2 58 105 / 0.13)`, with `translateY(-2px)`):
  The response to pointer entry on an interactive card.
- **Floating** (`box-shadow: 0 16px 36px rgb(1 20 40 / 0.34)`): Elements that overhang their
  container, such as the hero's credential badge.
- **Deep** (`box-shadow: 0 24px 60px rgb(1 20 40 / 0.5)`): Media framed on a navy band.
- **Gold Rest** (`box-shadow: 0 6px 20px rgb(248 184 1 / 0.32)`) and **Gold Hover**
  (`box-shadow: 0 10px 26px rgb(248 184 1 / 0.42)`): The primary action at rest and lit.

### Named Rules

**The Tinted-Shadow Rule.** No shadow uses neutral black. Navy on light, near-black navy
over media, gold under gold. A grey drop shadow is the tell of a generic template.

**The Two-Step Rule.** Interactive lift is `translateY(-2px)`, never more. The movement
should be felt as confirmation, not seen as animation.

## Shapes

Radii step with the size of the thing: `6px` for inline tokens and small chips, `9–12px`
for controls and inputs, `16–18px` for cards and panels, and full `999px` pills for
metadata tags. Nothing is sharp-cornered and nothing is a circle except avatars and status
dots.

The recurring silhouette is the **corner bracket** — a pair of 2px gold rules meeting at a
right angle, set inside the corner of framed media. It is the system's one ornamental move,
and it is drawn from the logo's open-book geometry rather than applied as decoration. It
marks something as *presented*: a portrait, a photograph, a certificate.

Borders are hairline (`1px`) except where a thing is being deliberately elevated in status:
the AAOIFI certificate card takes a `2px` Institutional Navy border and a navy-to-gold
gradient rule across its top edge, which is the visual argument that it is the more
important of the two documents.

## Components

### Buttons

Confident and tactile — generous padding, unambiguous fills, and a lift on hover that
confirms the press before it happens.

- **Shape:** Softly rounded (`11px`; `9px` in the compact header)
- **Primary:** Certificate Gold ground, Navy Deep text, `15px 28px`, with the Gold Rest
  glow. One per section.
- **Hover / Focus:** `translateY(-2px)` into the Gold Hover glow, `0.2s ease`.
- **Outline on navy:** `rgb(255 255 255 / 0.07)` ground with a `1.5px` white 30% border,
  brightening to 15% on hover.
- **Outline on light:** White ground, `1.5px` Institutional Navy border, navy text; hovers
  to Wash.

### Cards / Containers

- **Corner Style:** `16px` (content), `18px` (panels)
- **Background:** Surface white on Wash grounds; Wash Alt for the secondary certificate
- **Shadow Strategy:** Rest at idle, Hover Lift on interactive cards only
- **Border:** `1px` Line
- **Internal Padding:** `28px` for content cards, `30–32px` for panels

### Inputs / Fields

- **Style:** White ground, `1.5px` Line border, `10px` radius, `12px 14px` padding
- **Focus:** Border shifts to Institutional Navy with a `3px` gold ring at 35% — the ring is
  gold because focus is an invitation to act
- **Error:** Border to Danger (`#d14343`), message beneath at `0.8rem`
- **Placeholder:** Muted Light

### Navigation

Sticky, `rgb(255 255 255 / 0.94)` with a `12px` backdrop blur over a `1px` Line rule.
Links are Manrope 600 at `0.92rem` in Slate, transitioning to Institutional Navy on hover.
Below `980px` the link row is replaced by a bordered burger control and a stacked panel with
`1px` Line Soft dividers. The primary action stays visible at every width — it never
collapses into the menu.

### Placeholder Token (signature)

A bracketed monospace chip on a dashed border — Gold Ink on Gold Wash on light grounds,
Gold Light on a translucent gold field on navy. It renders a fact that has not been
supplied yet (`[NARX]`, `[OQIM SANASI]`, `[TELEFON]`).

This is a load-bearing component, not a stopgap. The brand's core claim is precision about
what is and is not true, so an unfilled fact is shown as conspicuously unfilled rather than
softened with plausible filler. It should look slightly uncomfortable.

### Status Chain (signature)

Three named nodes in Spectral, separated by a small gold diamond above a short hairline,
with the terminal node boxed in a `1.5px` Certificate Gold border on Cream. It exists to
render an institutional relationship precisely, and it collapses to a vertical stack with
rotated separators below `980px`.

## Do's and Don'ts

### Do:

- **Do** open every section with a Gold Deep eyebrow label above the headline.
- **Do** keep gold to at most two elements per section — the action and, at most, one
  credential mark.
- **Do** put Navy Deep text on every gold surface, without exception.
- **Do** use the separate on-navy text ramp (`#c6d6e6` / `#8fa8c0` / `#5e7a96`) on dark
  bands rather than the light-field greys.
- **Do** tint every shadow navy, or gold beneath gold.
- **Do** render unsupplied facts as bracketed placeholder tokens.
- **Do** alternate section grounds (white → wash → navy) so position is legible from colour.
- **Do** cap prose at 46–56ch for leads and 70ch for long answers.
- **Do** set both `--font-lp-heading` and `--font-lp-body`; a Spectral heading over a
  system-sans body is the system half-applied.

### Don't:

- **Don't** use a neutral grey drop shadow anywhere.
- **Don't** put white text on Certificate Gold.
- **Don't** introduce a third typeface, or use Inter/Source Serif 4 in new work — those are
  the legacy application scale this system supersedes.
- **Don't** italicise anything except quoted speech and the hero tagline.
- **Don't** exceed `translateY(-2px)` on hover, or add easing longer than `0.25s`.
- **Don't** build a centred hero over three equal flat cards; the approved world is
  asymmetric and hairline-structured.
- **Don't** add countdown timers, scarcity badges, discount flags, or stacked testimonial
  carousels.
- **Don't** apply dense Islamic geometric tiling, arabesque borders, calligraphy as
  ornament, or mosque silhouettes. The corner bracket is the permitted geometry.
- **Don't** reach for stock photography of handshakes, skylines, or trading floors.
- **Don't** invent a number, date, price, or claim to fill a placeholder.

---

## Migration status

This system is **canonical**, and the application surface has not yet adopted it.

- **On this system:** the marketing landing page (`app/[locale]/page.tsx`,
  `components/landing/*`), using `--color-lp-*` and `--font-lp-*` from `app/globals.css`.
- **On the legacy scale:** every logged-in surface — dashboard, catalog, course, player,
  studio, admin — using `navy-*` / `gold-*` with Inter and Source Serif 4, plus the
  shadcn/Base UI primitives in `components/ui/`.

The legacy palette is close in hue but not identical (`#023a69` is shared; `#1a2230` ink
versus `#0e2233`, `#e2e8f0` line versus `#e2e7ee`), and its type pairing is entirely
different. New work targets this system. Existing application surfaces migrate
progressively, starting with the ones a visitor reaches first from the landing page:
signup, login, then the student dashboard.
