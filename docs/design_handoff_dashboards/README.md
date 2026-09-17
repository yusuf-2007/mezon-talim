# Handoff: Mezon Ta'lim — Student & Admin Dashboards

## Overview

Redesign of both authenticated surfaces of the Mezon Ta'lim Next.js app:

- **Student dashboard** (`app/[locale]/(student)/dashboard/*`) — 7 views: Asosiy, Kurslarim, Xabarlar, Sertifikatlar, Katalog, Lug'at, Sozlamalar.
- **Admin dashboard** (`app/[locale]/(admin)/admin/*`) — 14 views: Asosiy, Arizalar, Kurslar, Foydalanuvchilar, Yozilishlar, Xabarlar, To'lovlar, Imtihonlar, Modul testlari, Sertifikatlar, Tahlil, Auditoriya, Yuborilganlar, Jurnal.

The core reframe on both sides: **the home view is a work surface, not a report.** The student home leads with "resume the lesson you were on" and a course map; the admin home leads with a work queue (new applications, unanswered questions, certificates ready to issue, payment problems). Finance and stats are present but secondary.

Both surfaces share one shell (navy rail, Spectral/Manrope type, gold as the single action colour) so student and admin read as one product. This also completes the migration DESIGN.md already calls for — moving the dashboard off the legacy Inter/Source-Serif scale onto the canonical system.

## About the Design Files

The `.dc.html` files in this bundle are **design references built in HTML** — interactive prototypes showing intended look and behaviour. They are **not production code to copy.** Recreate them in the existing codebase: Next.js App Router, Tailwind, shadcn/ui, next-intl, Drizzle. Use the existing `components/ui/*` primitives, the existing `components/student/*` and `components/admin/*` where they fit, and the existing repositories for data.

Open a `.dc.html` file directly in a browser to see it. Use the **Tweaks** panel (or edit `data-props` on the `<script data-dc-script>` tag) to switch `initialView` and see every view without clicking through. The admin file also has a `role` prop (`super_admin` / `accountant`) that hides `canManage`-gated nav items, mirroring `admin-nav.tsx`.

`screen-map.md` maps every view to the repo files it was designed from.

## Fidelity

**High-fidelity.** Colours, type, spacing, radii and states are final. Recreate to match, using Tailwind tokens (see Design Tokens — they map 1:1 to `tailwind.config.ts` colour names already in `globals.css`).

All **data is representative sample data.** Every list, count and name should come from the repositories; the sample values indicate shape and edge cases (empty, pending, revoked, failed), not content.

Copy is **Uzbek-first v1.** Move all strings into `messages/uz.json` / `ru.json` under the existing `Student` / `Admin` namespaces. Some strings are new keys.

## Shared Shell

### Rail (desktop ≥ 900px student / ≥ 900px admin)
- Width **236px** (student) / **244px** (admin). `position: sticky; top: 0; height: 100vh`.
- Background `#023A69` with the diamond-lattice texture at 5% white (SVG data-URI, 44px tile — see Design Tokens → Motif).
- Logo row: book mark (two skewed pages, `#9BB8D4` left + `#F8B801` right) + wordmark in Spectral 600 1.15rem, "Mezon" white, "Ta'lim" `#F8B801`. Admin adds an `ADMIN` chip: `#F8B801` bg, `#011E38` text, .6rem 800 uppercase, radius 5.
- Group labels: .66rem 700, letter-spacing .16em, uppercase, `#5E7A96`, padding `20–30px 12px 8–10px`.
- Nav item: flex, gap 12, padding `9–10px 12px`, radius 9–10, `#C6D6E6` .9–.92rem 600. Hover `rgba(255,255,255,.08)`. Active `rgba(255,255,255,.12)` + white text. Admin items carry a 6px dot (`#5E7A96`, `#F8B801` when active) and optional badge pill (.7rem 800, `#F8B801`/`#011E38` for hot, `#F5E2A8`/`#011E38` for warning, `rgba(255,255,255,.14)`/white otherwise).
- Footer (margin-top auto, border-top `rgba(255,255,255,.1)`): 36px avatar circle (`#F8B801` bg + `#011E38` initials for students; `#0B4C82` + white for staff), name .88rem 700 white, role .74rem `#8FA8C0`. Student footer also has the UZ/RU segmented control and "Chiqish".
- Student file has a `railStyle: light` variant (white rail, `#E2E7EE` right border, active item solid `#023A69`, real PNG logo). Ship navy; keep light as a future option.

### Main
- Padding `28px 40px 60px` (student) / `24px 36px 56px` (admin); inner `max-width` 1120px / 1240px, centred.
- Page header: eyebrow .72–.74rem 700 `.16em` uppercase `#C08E00`; `h1` Spectral 600 1.75–1.9rem, `#023A69`, letter-spacing −.01em. Right side: date (student) or global search + gold "Yangi" button (admin). Search input has a `⌘K` kbd hint at ≥900px.
- View switch animation: `opacity 0→1, translateY(6px→0)`, 350ms `cubic-bezier(.2,.7,.2,1)`.

### Mobile (< 900px student, < 900px admin)
- Rail hides. **Student:** fixed bottom tab bar (Asosiy / Kurslarim / Xabarlar / Sertifikatlar / Menyu), `rgba(255,255,255,.96)` + `backdrop-filter: blur(12px)`, active colour `#023A69`, inactive `#8A97A6`. "Menyu" opens a bottom sheet (radius 18px top, shadow `0 -12px 40px rgba(2,58,105,.18)`, scrim `rgba(1,30,56,.45)`) listing Katalog, Lug'at, Sozlamalar, UZ/RU, Chiqish. Selecting any item navigates and closes.
- **Admin:** no mobile nav is designed. **Decision needed:** either treat admin as desktop-only (acceptable for v1) or reuse the student bottom-sheet pattern with the grouped items.

## Card & Table Vocabulary (used everywhere)

- **Card**: `#fff`, border `1px #E2E7EE`, radius **16px**, shadow `0 2px 10px rgba(2,58,105,.05)`. Hover-lift variant adds `translateY(-2px)` + `0 14px 32px rgba(2,58,105,.13)` over 220ms.
- **Navy feature panel**: `#023A69`, radius 18px, lattice texture 6%, optional radial glow top-right `rgba(11,76,130,.7)`, shadow `0 16px 40px rgba(1,20,40,.22)`.
- **Section eyebrow inside cards**: .72rem 700 `.14em` uppercase `#C08E00`; card title Spectral 600 1.2–1.3rem `#023A69`.
- **KPI strip (`.qgrid`)**: one card, 4 cells divided by `1px #EFF2F6` left borders; cell padding 18–20px 24px; label .72rem uppercase `#8A97A6`; value Spectral 600 1.9rem tabular; sub .8rem. Collapses to 2×2 at ≤1100px.
- **Table (`.tbl`)**: wrapped in `overflow-x:auto`. `th` .7rem 700 `.1em` uppercase `#8A97A6`, bg `#FBFCFD`, padding 12 16, border-bottom `#E2E7EE`. `td` padding 14 16, .9rem, border-bottom `#EFF2F6`. Row hover `#FBFCFD`. Columns marked `.hidem` hide at ≤1100px.
- **Status dot + label**: 7px circle + .78rem 700. Green `#1E9E6A`/text `#146B44`; amber `#F8B801`/`#8A5B00`; red `#C0453A`; neutral `#DCE3EC`/`#8A97A6`; navy `#0B4C82`/`#023A69`.
- **Pill tag**: .72rem 700, radius 999, padding 3 9. Navy tint `#E7EEF4`/`#023A69`; gold tint `#FEF3D2`/`#8A5B00`; green tint `#E4F4EC`/`#146B44`; grey `#EFF2F6`/`#8A97A6`.
- **Segmented control**: white card radius 10 padding 4; active segment `#023A69` bg white text radius 7; inactive `#46586B`. .84–.88rem 700.
- **Filter chips**: radius 999, padding 6–7 12–14; active `#023A69`/white; inactive white + `1px #E2E7EE`, `#46586B` 600.
- **Warning banner**: `#FFFAEC` bg, `1px #F5E2A8` border, radius 12, 8px gold dot, .84rem; danger variant `#FBE9E7`/`#F0C9C4`/red dot; info variant `#E7EEF4` with info icon.
- **Dashed "next step" row**: `1px dashed #DCE3EC`, radius 16, padding 22 28.

### Buttons
- **Primary (gold)**: `#F8B801` bg, `#011E38` text, 700, radius 9–11, padding `10–13px 16–24px`, shadow `0 4–6px 14–20px rgba(248,184,1,.28–.32)`. Hover `translateY(-2px)` + `0 10px 26px rgba(248,184,1,.42)`. **Never white text on gold.** One gold button per view region.
- **Secondary (navy fill)**: `#023A69` bg, white, 700, radius 9.
- **Outline**: white bg, `#023A69` text, `1.5px #023A69` border, 700, radius 8–9; hover bg `#F3F6FA`.
- **Quiet outline**: as above with `#E2E7EE` border.
- **Ghost link**: `#0B4C82` 700 .82–.86rem, trailing `→`.
- **Toggle**: 42×24 pill, `#023A69` on / `#DCE3EC` off, 18px white knob with `0 1px 3px rgba(2,58,105,.25)`, 200ms.

### Inputs
- `.fld`: `1.5px #E2E7EE` border, radius 9–10, padding 9–12 12–14, .9–.92rem. Focus: border `#023A69` + ring `0 0 0 3px rgba(248,184,1,.35)`. Placeholder `#A9B4C0`.

---

## Student Dashboard — Views

### 1. Asosiy (home)
Data: `progress.resumeLessonId`, `lesson_progress.last_position_seconds`, `curriculum.ts` read model, `messageThreads`, `certificates`, `glossary`, notes/bookmarks counts.

1. **Resume panel** — navy feature panel, grid `1.2fr .8fr` gap 36, padding 34 36. Left: gold rule + eyebrow "Davom etish · {course}"; `h2` Spectral 600 `clamp(1.5rem,2.6vw,2.15rem)` white — lesson title; meta row .88rem `#C6D6E6` (module · exact `mm:ss / mm:ss dan davom etadi`); gold "▶ Davom etish" + on-navy outline "Dars konspekti" (`rgba(255,255,255,.07)` bg, `1.5px rgba(255,255,255,.3)` border). Right: 16:9 thumbnail radius 14, shadow `0 18px 44px rgba(1,20,40,.45)`, centred 56px play circle (`rgba(255,255,255,.14)` + `1.5px rgba(255,255,255,.5)` border + blur 4), 4px bottom progress track `rgba(255,255,255,.18)` with **white** fill, duration pill bottom-right. Gold corner brackets (22px, 2px) top-left and bottom-right of the thumbnail.
2. **Course map** card. Header: eyebrow "Kurs xaritasi", title; right: Spectral 2rem `6 / 12` (second number `#A9B4C0` 500) + "dars yakunlandi". Body grid 4 columns (modules), each: label + status (`Yakunlandi` green / `Test kutilmoqda` amber / `Joriy` gold / blank), module title .95rem 700, **lesson ticks** — flex row of 10px-tall bars radius 3: done `#023A69` fill, current `#F8B801`, locked transparent + `1.5px #DCE3EC`. Meta .78rem. Columns divided by `1px #EFF2F6` (not on last). Footer legend + "To'liq dastur →". Collapses 2×2 at ≤980, 1 col ≤560.
3. **Three-cell strip** — one card, `1.1fr 1fr 1fr`, hairline dividers. (a) Next test: title Spectral 1.15rem, meta `10 savol | o'tish 70% | 3 urinish`, outline "Testni boshlash". (b) This week: eyebrow + Spectral 1.2rem total; 7 bars (height ∝ minutes, `#023A69`, today `#F8B801`, empty `#EFF2F6` 4px), day labels Du…Ya (today 800 `#023A69`); summary line. (c) Pending question: eyebrow + amber pill "Javob kutilmoqda"; question in Spectral italic 500 1rem `«…»`; lesson meta; "Barcha xabarlar →". Whole cell clickable → Xabarlar.
4. **Bottom row** `1.15fr .85fr`. Left: certificate artefact card (`#F3F6FA` bg) — 236px mini certificate (A-landscape `aspect-ratio 1.414`, `1.5px #023A69` border radius 6, 4px navy→gold gradient rule on top, lattice 5%, MEZON TA'LIM / Sertifikat / name Spectral .9rem / course / gold seal 18px) with gold corner brackets, beside: eyebrow "Sertifikatim", title, code in monospace chip `MZN-XXXX-XXXX` + date, outline "PDF yuklab olish" + ghost "Tekshirish sahifasi →". Right: quiet stack card — "Kunning atamasi" (term Spectral 1.25rem + EN gloss + definition; hidden if `showGlossary` false), then two link rows "Eslatmalarim · 4 ta →", "Xatcho'plar · 2 ta →" with 18px line icons.

### 2. Kurslarim
One card, one row per enrollment: grid `200px 1fr auto` gap 26, padding 24 28, `#EFF2F6` dividers. Thumbnail 16:10 radius 10 navy with lattice; 4px bottom bar (gold fill = progress, solid navy when complete). Middle: eyebrow (`Davom etmoqda · 12 dars` gold / `Yakunlangan · 8 dars` grey), title Spectral 1.3rem, **flat lesson ticks** (all 12, same colour rules as course map, max-width 320), meta line `6 / 12 dars | Keyingi: 7-dars, 14:20 dan | Kirish muddati: …`. Right: gold "▶ Davom etish" (in progress) or green-tint "✓ Yakunlangan" pill + outline "Qayta ko'rish". Below: dashed row "Keyingi kursni tanlang" → Katalog. At ≤980: `120px 1fr`, action spans full width on its own line.

### 3. Xabarlar
Segmented control "Ustozga savol (1) | Muhokama". **Ustozga savol**: card with grey header (lesson number Spectral gold `05`, lesson title 700, amber pill, "Darsga o'tish →"), thread body — student bubble right-aligned `#E7EEF4` radius `14 14 4 14`, teacher slot left with dashed-border placeholder "Ustoz javobi kutilmoqda · odatda 24 soat ichida" and three-dot indicator; composer textarea + "Savol faqat siz va ustozga ko'rinadi" + navy "Yuborish". **Muhokama** (empty state): centred 52px icon tile `#E7EEF4`, Spectral 1.3rem title, 46ch body, outline CTA "7-dars muhokamasiga o'tish". Empty states must explain the feature and link to the current lesson.

### 4. Sertifikatlar
Card grid `1.25fr .75fr` gap 34, padding 30. Left: full certificate (same construction as the mini, `2px #023A69` border, 7px gradient rule, gold seal `clamp(28px,5vw,46px)`, signature/date rules `#DCE3EC`, all type in `clamp()`), gold corner brackets 24px. Right: eyebrow "Mezon Ta'lim beradi", title Spectral 1.45rem, definition list rows (`Berilgan sana`, `Yakuniy imtihon 86% · 1-urinish`, `Tekshiruv kodi` mono, `Holati` ● Haqiqiy) with `#EFF2F6` dividers; gold full-width "PDF yuklab olish", then two half-width outlines "Tekshirish sahifasi" / "Havolani nusxalash"; disclaimer .78rem `#8A97A6`: *"Bu Mezon Ta'limning kursni yakunlaganlik sertifikati. AAOIFI sertifikati emas."* — **keep this line.** Below: dashed "locked next certificate" row with lock icon tile explaining the 70% rule and current progress.

### 5. Katalog
Filter chips (Barchasi / Tadbirkorlar uchun / Bank xodimlari uchun / Bepul kirish darsi). **CPSS featured** navy panel, `1.25fr .75fr`: eyebrow "Asosiy dastur · oqim asosida", title, spec line `30 dars · 15 hafta · ~90 soat · 70% onlayn…`, gold "Ariza qoldirish" + "Keyingi oqim: [OQIM SANASI]" placeholder token (dashed `rgba(255,255,255,.35)` border, mono, `#C6D6E6`); right column definition rows divided by `rgba(255,255,255,.1)` (Format / Til / Guruh / To'lov: Konsultatsiyadan so'ng — **no price shown for CPSS**). Then eyebrow "Onlayn kurslar · o'z sur'atida" + card list, one row per course (`200px 1fr auto`), thumbnail tag pill, eyebrow `{audience} · {n} dars`, title, description, meta; right: price/state Spectral 1.2rem + state-dependent button — enrolled → gold "Davom etish", completed → outline "Qayta ko'rish", new → outline "Batafsil" with `[NARX]` placeholder. Footer note about Click/Payme + corporate invoices.

### 6. Lug'at
Search field (icon left) + segmented "Barchasi · 48 | Shu kurs · 22" (maps to `glossaryRepository.listForCourse` global-or-course scope). A–Z letter index: 30px squares radius 7, active `#023A69`/white, letters with no terms `#DCE3EC`. Term list card, one row `200px 1fr auto`: Uzbek term Spectral 600 1.2rem + `{EN} · EN` gloss; definition .92rem 64ch; right: scope pill (`Umumiy` / `Shu kurs`) + "{n}-dars →" link to where it's taught. Footer note on bilingual terminology.

### 7. Sozlamalar
Grid `220px 1fr`: sticky sub-nav (Profil active white card / Bildirishnomalar / Xavfsizlik / Til va mintaqa) + stacked sections. **Profil**: avatar 68px + "Rasm yuklash" outline; 2-col fields — To'liq ism (label suffix *"— sertifikatda shu yoziladi"*), Telefon (green ✓ Tasdiqlangan), Email (amber "Tasdiqlash" action), Ish joyi (optional); grey footer bar with "Bekor qilish" ghost + navy "Saqlash". **Bildirishnomalar**: three toggle rows (Email / SMS / Telegram "Tez orada" off) and **SMS consent date shown inline** — *"Rozilik: 03.03.2026, ro'yxatdan o'tishda"* — this is the Eskiz §4.1.8 record; surface `sms_consent_at`. **Xavfsizlik** + **Til va mintaqa** side by side; interface language segmented O'zbek/Русский with note that lesson language is per-course. Bottom: dashed red-tint row "Hisobni o'chirish" — note that issued certificates stay verifiable. **Confirm field set against `settings/page.tsx` / `profile-edit-form.tsx` before implementing** (Ish joyi may not exist; email may be required).

---

## Admin Dashboard — Views

Role gating: items marked `manage` in `admin-nav.tsx` are hidden for `accountant`. The `role` prop in the prototype demonstrates this.

### 1. Asosiy (home)
1. **Work queue** card: header with gold rule + "Bugun kutayotgan ishlar" + "Yangilandi: hozirgina"; 4 cells (`.qgrid`), each clickable: label .78rem 700, 8px status dot (gold / gold / green / red), Spectral 2.4rem count (red for payment problems), unit, sub-line (e.g. *"3 tasi 24 soatdan oshdi"*, *"Eng eskisi — kecha 21:14"*), ghost CTA. Sources: `applicationsRepository.countByStatus()` (new), open `messageThreads` without teacher reply, students who passed the final exam without a certificate row, `payments` with `status in (pending, failed)`.
2. **Split `1.2fr .8fr`**. Left **Arizalar** card: eyebrow "Arizalar · CPSS", title "Yangi murojaatlar", "Barchasi · 23 →"; **funnel bar** — 4 segments flex-weighted by count (`new` gold, `contacted` navy, `enrolled` green, `declined` grey), 6px tall, labels below; table (Ism/telefon · org, Manba pill, Kelgan, outline "📞 Bog'lanildi" action that sets `status=contacted`). Right: **Ustozga savollar** card — 3 rows: student name, age chip coloured by SLA (`>24h` red `#C0453A`, `>6h` amber `#8A5B00`, else grey), question in Spectral italic, lesson ref; then **payments attention** amber banner (pending/failed summary + link).
3. **Finance + courses** `1.15fr .85fr`. Revenue card: eyebrow "Tushum · 30 kun", Spectral 2.1rem total + "so'm" + green `+18%` pill; right-aligned `29 to'lov · 61% Click · 39% Payme`; 30 bars 96px tall (`#023A69`, today `#F8B801`, zero-days `#EFF2F6` 3px), axis labels. Courses card: rows with title + status pill + 5px progress bar + `{active} faol / {done} bitirgan`.
4. **So'nggi harakatlar** card: rows `80px 22px 1fr` — time, 22px tinted circle with 6px dot (green payment / gold application / navy admin action / red failure), text + `· actor`. Source: `auditRepository.recentWithActor`.

### 2. Arizalar (new route — repository exists, page does not)
Segmented status filter with counts (Yangi 8 / Bog'lanilgan 11 / Yozilgan 3 / Rad etilgan 1), source filter chip, CSV export. Table: checkbox, name + phone, Tashkilot, Manba pill + locale, **SMS roziligi** (● Bor green / ● Yo'q grey — from `sms_consent_at`), Kelgan, Holat as an outline dropdown chip coloured by status (new gold-tint, contacted navy-tint, enrolled green-tint, declined grey). Footer: pagination + *"Yangi arizalar 24 soat ichida bog'lanishi kutiladi."*

### 3. Kurslar
Segmented status filter + gold "Yangi kurs". Rows `150px 1fr 200px auto`: thumbnail with status pill; eyebrow (audience), Spectral 1.15rem title, meta `{m} modul · {n} dars | price | /slug`; stats column (Yozilgan / Bitirgan / Tushum, right-aligned tabular); outline "Studio →" + updated time. Footer note: content is edited in Studio; here only status, price, metrics. Source: `analyticsRepository.allCoursesWithStats()`.

### 4. Foydalanuvchilar
KPI strip (Jami / Talabalar / Xodimlar / Tasdiqlanmagan amber). Card: role filter chips + "Kursga yozish" (`EnrollStudentsDialog`) + CSV. Table: avatar 32px (gold = teacher, navy = admin, navy-tint = student) + name + contact; **role as inline dropdown pill** (`RoleSelect`; Talaba navy-tint, Ustoz gold-tint, Super admin solid navy, Buxgalter green-tint); Kurslar; Tasdiq (● Tasdiqlangan / ● Kutilmoqda); Ro'yxatdan; Holat (Faol green / Bloklangan red). Footer: *"Rol o'zgarishi jurnalga yoziladi."*

### 5. Yozilishlar
Segmented (Faol / Yakunlangan / Muddati tugagan) + course filter + gold "Qo'lda yozish". Table: student + start date; Kurs; **Jarayon** — 6px bar (navy, green when complete) + `done / total`; So'nggi faollik coloured (red if >14 days); Kirish muddati; Manba pill (Click / Payme / B2B). Below: amber banner *"11 talaba 14 kundan beri faol emas"* → "Eslatma yuborish →".

### 6. Xabarlar
Split `340px 1fr`. Left: thread list with segmented "Ochiq · 4 | Javob berilgan"; rows with 3px left edge (`#F8B801` on selected), name, SLA age chip, one-line preview, lesson ref. Right: conversation — grey header (student avatar, name, `course · lesson · timestamp`, outline "Darsni ochish" / "Profil"), student bubble `#F3F6FA` radius `4 14 14 14`, **quick-reply chips** ("Standart 9 §5/1/7", "Lug'at: Ijara") that insert snippets, composer textarea + checked checkbox "Talabaga email + SMS yuborilsin" + quiet-outline "Muhokamaga ko'chirish" + navy "Javob yuborish".

### 7. To'lovlar (visible to accountant)
KPI strip (Jami tushum / Bu oy +18% / Kutilmoqda amber / Muvaffaqiyatsiz red). Card: provider chips (Barchasi / Click / Payme / Bank) + "Hisobot (CSV)". Table: Vaqt, Xaridor + provider ref mono, Kurs, Provayder, Summa (right, tabular), Holat dot (To'landi green / Kutilmoqda amber / Muvaffaqiyatsiz red). B2B invoice rows appear here (`inv_0042`, provider "Bank").

### 8. Imtihonlar (replaces ComingSoon)
KPI strip (Urinishlar 30 kun / O'tish darajasi + first-try rate / O'rtacha ball vs threshold / Qiyin savollar red). Split: left **Yakuniy imtihonlar** — one row per course exam: title + status pill, spec `{q} savol | {t} daqiqa | chegara 70% | 3 urinish`, stacked pass/fail bar (green/red) + counts, footer outline "Savollar bankini ochish →". Right **Eng ko'p xato qilinadigan savollar** — rows `44px 1fr`: Spectral 1.3rem correct-% (red <35, amber <40), question text, `where · n urinish · ko'p tanlangan xato: "…"`, explanatory footnote. Below: **So'nggi urinishlar** table (Vaqt, Talaba · n-urinish, Imtihon, Ball coloured, Vaqt sarfi, Natija dot). Sources: `assessments.ts`, `attempts.ts`.

### 9. Modul testlari (replaces ComingSoon)
Course selector dropdown chip + rule text *"Modul testi = modul yakunida, o'tish 70%, 3 urinish. Keyingi modul faqat testdan so'ng ochiladi."* Rows `56px 1fr 220px 180px auto`: Spectral 1.8rem module number (`#C7D3DF`, gold-tint `#F0D48A` for missing), title + `{q} savol · {n} darsdan · updated`, pass-rate bar (green ≥70, amber below), `{waiting} talaba test kutmoqda / {n} urinish`, status pill + outline "Tahrirlash". Amber banner when a module has no test: *"4-modul testi hali yaratilmagan — 2 talaba 3-modulni tugatgach shu yerda to'xtab qoladi."* This is the sequential-unlock rule from `curriculum.ts` made visible.

### 10. Sertifikatlar
Navy panel: eyebrow "Tasdiqlash kutilmoqda", title *"3 ta talaba imtihondan o'tdi — sertifikat tayyor"*, note to verify name spelling, gold "3 tasini berish" (bulk issue). Table: Talaba + note (e.g. *"Ismda kichik harf — tekshiring"*), Kurs, Imtihon `92% · 1-urinish`, Kod mono, Sana, Holat — gold "Berish" button for pending rows, otherwise dot (Berilgan green / Bekor qilingan red with reason in the note).

### 11. Tahlil (visible to accountant)
Period segmented (7/30/90 kun/Yil) + "Hisobot (PDF)". KPI strip with deltas (Tushum / Yangi yozilishlar / Yakunlash darajasi *"sertifikat ÷ yozilish (B35)"* / Faol talabalar red delta). Split `1.2fr .8fr`: **Voronka** — 6 horizontal bars `150px 1fr 90px` (Landing tashrifi → Ariza/ro'yxat → To'lov boshlandi → To'landi → 1-dars ko'rildi → Sertifikat gold), count + step conversion %; **Tushum manbalari** — 4 bars (2 courses navy, Click gold, Payme light gold). Full-width **Dars bo'yicha tark etish**: 12 bars (students who started each lesson), the cliff lesson highlighted gold, amber banner naming the drop (*"6 → 7-dars orasida −31% — 2-modul testidan keyingi nuqta"*).

### 12. Auditoriya (visible to accountant)
KPI strip (Javoblar +30d / Javob darajasi / Ro'yxatdan o'tganlar / **So'rov varianti A·Kasb | B·Maqsad** segmented — `PollVariantControl`). Split: two cards "Kim kelmoqda" (visitors) and "Kim yozilmoqda" (registrants), each a 14px stacked bar + legend rows (Tadbirkor gold, Bank xodimi navy, Talaba `#0B4C82`, O'qituvchi green, Boshqa `#B9CBDB`) with % · n. Info banner with the written insight comparing the two.

### 13. Yuborilganlar
KPI strip (Yetkazilgan green / Yuborilgan / Rad etilgan red / Muvaffaqiyatsiz red). **Red banner** when rejections cluster: *"9 rad etish 2 soat ichida — barchasi Eskiz, «Ucell» raqamlari. Bu talabaning emas, shlyuzning muammosi."* → "Eskiz holatini tekshirish →". Card: channel chips (Barchasi / SMS / Email / **Faqat muammoli** red outline). Table: Vaqt, Qabul qiluvchi + address, Kanal pill, Turi, **Provayder javobi** mono (`eskiz: DELIVRD`, `REJECTD (op=ucell)`, `resend: 250 OK`), Holat dot. Batch sends show `12 / 14` amber.

### 14. Jurnal
Type chips (Barchasi / Foydalanuvchi / Kurs / To'lov / Sertifikat) + actor dropdown. Rows `130px 160px 1fr auto`: time, 26px actor avatar (⚙ grey for `tizim`, solid navy for super admin, navy-tint others) + name, **mono action code chip** coloured by severity (navy-tint default, gold-tint for `application.*` / `user.role`, red-tint for `payment.failed` / `payment.refund` / `certificate.revoke`) + detail, entity ref mono right. Footer: *"Jurnal o'zgartirilmaydi va 3 yil saqlanadi."* At ≤1100 rows become 2 columns.

---

## Interactions & Behaviour

- View switching is client-side in the prototype; in Next.js these are routes. Preserve the 350ms fade-rise on route content.
- Hover: cards `translateY(-2px)` 220ms; gold buttons lift 200ms; rows tint `#FBFCFD` 150ms; rail items 180ms.
- Easing everywhere: `cubic-bezier(.2,.7,.2,1)`. No bounce/spring. Respect `prefers-reduced-motion`.
- Work-queue cells, question rows, "Barchasi →" links navigate to the matching view/filter.
- Student "Menyu" sheet: tap outside or select to close.
- Admin "Bog'lanildi" action → optimistic status change to `contacted`, audit row.
- Bulk "3 tasini berish" → confirm dialog listing names, then issue + audit rows.
- Tables scroll horizontally on overflow; `.hidem` columns hide ≤1100px.

## State Management

Student: `view` (route), `seg` (Xabarlar tab), `more` (mobile sheet open). Data via existing server components + repositories; no new client state beyond forms.

Admin: `view` (route), selected thread (Xabarlar), filters per table (URL search params, as `users/page.tsx` already does with `?q=`), period (Tahlil). Work-queue counts should be one server call composing existing repository methods.

New data needs:
- `applications` admin route (list, filter by status/source, update status, CSV).
- Weekly study minutes per student (from `lesson_progress` timestamps) for the "Bu hafta" bars.
- Per-question correct-rate aggregate for "Qiyin savollar".
- Per-lesson "started" counts for drop-off.
- Students who passed final exam with no certificate row (issuance queue).

## Design Tokens

Already in `globals.css` / `tailwind.config.ts` per `Design Language.dc.html`; listed for reference.

```
Navy:    #011E38 ink · #033668 deep · #023A69 DEFAULT · #0B4C82 600 · #1D6099 500 · #B9CBDB 200 · #E7EEF4 100 · #F3F6FA 50
Gold:    #F8B801 DEFAULT · #E0A600 600 · #C08E00 700 · #FBD968 300 · #FEF3D2 100 · #F5E2A8 (banner border) · #FFFAEC (banner bg) · #F0D48A (muted number)
Neutral: #FFFFFF · #FBFCFD row-hover · #F7F9FB paper · #EFF2F6 divider · #E2E7EE border · #DCE3EC tick/locked · #A9B4C0 placeholder · #8A97A6 muted · #46586B text · #0E2233 ink
On-navy: #C6D6E6 body · #8FA8C0 muted · #5E7A96 label · #9BB8D4 logo page
Success: #1E9E6A dot · #146B44 text · #E4F4EC tint
Danger:  #C0453A · #FBE9E7 tint · #F0C9C4 border
Warning: #8A5B00 text on gold tints

Type:    Spectral 400/500/600 (+ italic 500) headings, numbers, quotes · Manrope 400–800 UI
Scale:   h1 1.75–1.9rem · card title 1.2–1.3rem · big number 1.9–2.4rem · body .9–.92rem · meta .8–.84rem · eyebrow .72rem/.14em/uppercase · table th .7rem/.1em
Numbers: font-variant-numeric: tabular-nums on all counts, times, money
Radius:  card 16 · feature panel 18 · button 9–11 · chip 999 · input 9–10 · thumbnail 10–14 · sheet 18 top
Shadow:  card 0 2px 10px rgba(2,58,105,.05) · lift 0 14px 32px rgba(2,58,105,.13) · panel 0 16px 40px rgba(1,20,40,.22) · gold 0 6px 20px rgba(248,184,1,.32) · ring 0 0 0 3px rgba(248,184,1,.35)
Motif:   diamond lattice SVG tile — <path d="M22 1 L43 22 L22 43 L1 22 Z" fill="none" stroke="#fff" stroke-opacity=".05–.07"/> on 44–46px tile over navy; #023A69 at .04–.05 over light. Gold corner brackets: 18–24px squares with 2px L-borders.
Grid:    rail 236/244 · main max 1120/1240 · gutters 40/36 (20/18 mobile) · breakpoints 1100 (hide .hidem, 2×2 KPI), 980/900 (stack, rail → tabs)
```

## Assets

- `assets/mezon-logo-horizontal.png`, `assets/mezon-logo-stacked.png` — supplied brand logos (use the SVGs in the repo's `public/` if present).
- Icons: Lucide, 1.75px stroke, 18–20px (rail), 14–18px (inline). Already the codebase's icon set.
- Fonts: Google Fonts Spectral + Manrope with Cyrillic subsets (already configured per DESIGN.md).
- Photos: none required; thumbnails are navy lattice placeholders until course covers exist.

## Files

- `Student Dashboard.dc.html` — 7 student views. Props: `initialView`, `railStyle`, `showGlossary`.
- `Admin Dashboard.dc.html` — 14 admin views. Props: `initialView`, `role`.
- `Design Language.dc.html` — the token/component spec both dashboards are built on.
- `support.js` — runtime the `.dc.html` files need to render; not for the app.
- `screen-map.md` — view → repo file mapping (copy of `github.md`).
- `assets/` — logos.
