repo: yusuf-2007/mezon-talim
branch: main

## Last sync
date: 2026-09-17T11:40:00+05:00

### Updated in this project
- Read all 14 admin routes, admin-nav.tsx, analytics/applications/notifications/audit repositories
- Designed the full admin surface (14 views) around a work queue — applications, questions, certificates, payment issues — with finance secondary
- Module tests and quizzes were ComingSoon stubs; designed from the data model and sequential-unlock rules

## Sync history
- 2026-09-16T21:20:00+05:00 — student dashboard (7 views) from dashboard routes, DESIGN.md, PRODUCT.md, data-model.md

## Screen map
| Project screen | Repo files |
|---|---|
| Admin Dashboard.dc.html (Asosiy) | app/[locale]/(admin)/admin/page.tsx, components/admin/admin-nav.tsx, components/admin/stat-card.tsx, components/admin/revenue-bars.tsx, lib/db/repositories/analytics.ts, lib/db/repositories/applications.ts |
| Admin Dashboard.dc.html (Arizalar) | lib/db/repositories/applications.ts — no route yet |
| Admin Dashboard.dc.html (Kurslar) | app/[locale]/(admin)/admin/courses/page.tsx, components/admin/course-status-select.tsx |
| Admin Dashboard.dc.html (Foydalanuvchilar) | app/[locale]/(admin)/admin/users/page.tsx, components/admin/role-select.tsx, components/admin/user-avatar.tsx |
| Admin Dashboard.dc.html (Yozilishlar) | app/[locale]/(admin)/admin/enrollments/page.tsx, components/admin/enroll-students-dialog.tsx |
| Admin Dashboard.dc.html (Xabarlar) | app/[locale]/(admin)/admin/messages/page.tsx |
| Admin Dashboard.dc.html (To'lovlar) | app/[locale]/(admin)/admin/payments/page.tsx, lib/payments |
| Admin Dashboard.dc.html (Imtihonlar) | app/[locale]/(admin)/admin/quizzes/page.tsx (ComingSoon), lib/db/repositories/assessments.ts, attempts.ts |
| Admin Dashboard.dc.html (Modul testlari) | app/[locale]/(admin)/admin/module-tests/page.tsx (ComingSoon), lib/learning/curriculum.ts |
| Admin Dashboard.dc.html (Sertifikatlar) | app/[locale]/(admin)/admin/certificates/page.tsx |
| Admin Dashboard.dc.html (Tahlil) | app/[locale]/(admin)/admin/analytics/page.tsx, lib/db/repositories/analytics.ts |
| Admin Dashboard.dc.html (Auditoriya) | app/[locale]/(admin)/admin/audience/page.tsx, lib/db/repositories/audience.ts, components/admin/poll-variant-control.tsx |
| Admin Dashboard.dc.html (Yuborilganlar) | app/[locale]/(admin)/admin/notifications/page.tsx, lib/db/repositories/notifications.ts |
| Admin Dashboard.dc.html (Jurnal) | app/[locale]/(admin)/admin/audit/page.tsx, lib/db/repositories/audit.ts |
| Student Dashboard.dc.html (Asosiy) | app/[locale]/(student)/dashboard/page.tsx, app/[locale]/(student)/dashboard/layout.tsx, components/student/dashboard-nav.tsx, components/student/dashboard-tabs.tsx, components/student/course-progress-card.tsx, components/student/cert-card.tsx, lib/learning/curriculum.ts |
| Student Dashboard.dc.html (Kurslarim) | app/[locale]/(student)/dashboard/courses, components/student/course-progress-card.tsx |
| Student Dashboard.dc.html (Xabarlar) | app/[locale]/(student)/dashboard/messages, components/student/student-messages.tsx |
| Student Dashboard.dc.html (Sertifikatlar) | app/[locale]/(student)/dashboard/certificates, components/student/cert-card.tsx |
| Landing Page CPSS.dc.html | app/[locale]/page.tsx, components/landing/*, docs/LANDING-DESIGN-MASTERPROMPT.md |
| Design Language.dc.html | DESIGN.md, docs/design-system.md, app/globals.css |
