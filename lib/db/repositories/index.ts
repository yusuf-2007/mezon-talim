/**
 * Repository layer — the data-access swap boundary (CLAUDE.md §2.5).
 * Each domain exposes a typed repository object; UI/route/server-action code
 * imports from here, never from `../client` or drizzle directly.
 *
 * Phase 1 ships the `courses` reference pattern. Sibling repositories
 * (users, enrollments, lessons, assessments, payments, certificates, …) are
 * added as their phases land.
 */
export { coursesRepository } from "./courses";
export { modulesRepository } from "./modules";
export { lessonsRepository } from "./lessons";
export { enrollmentsRepository } from "./enrollments";
export { lessonProgressRepository } from "./lesson-progress";
export { notesRepository } from "./notes";
export { bookmarksRepository } from "./bookmarks";
export { glossaryRepository } from "./glossary";
export { assessmentsRepository } from "./assessments";
export { questionsRepository } from "./questions";
export { attemptsRepository } from "./attempts";
export { paymentsRepository } from "./payments";
export { usersRepository } from "./users";
export { phoneOtpsRepository } from "./phone-otps";
export { verificationTokensRepository } from "./verification-tokens";
export { certificatesRepository } from "./certificates";
export { notificationsRepository } from "./notifications";
