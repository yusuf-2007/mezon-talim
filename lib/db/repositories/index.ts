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
export { usersRepository } from "./users";
export { phoneOtpsRepository } from "./phone-otps";
export { verificationTokensRepository } from "./verification-tokens";
