import "server-only";
import { randomBytes } from "node:crypto";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { usersRepository } from "@/lib/db/repositories/users";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { getExamPrerequisites, moduleLessonsStatus } from "@/lib/assessments/gating";
import { moduleCertificatesActive } from "@/lib/learning/modules";
import { getStorageClient, isStorageConfigured } from "@/lib/storage";
import {
  notifyCertificateIssued,
  notifyModuleCertificateIssued,
} from "@/lib/notifications/service";
import { generateCertificatePdf } from "./pdf";
import { pickLocale } from "@/lib/i18n/localized";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n/routing";
import type { LocalizedText } from "@/lib/db/schema";

/**
 * Certificate issuance & verification (TBD #2: Mezon's own completion cert).
 *
 * Two kinds share one table:
 *  - course: gated on a *passing final-exam attempt* (plus all lessons and all
 *    published module exams) for a certificate-enabled course; marks the
 *    enrollment completed.
 *  - module ("milestone"): one per module — every lesson of the module done
 *    AND its published, scored module exam passed; only when the course has
 *    both certificate switches on. Never marks the enrollment completed and
 *    never affects the course certificate (or another module's).
 *
 * Both are idempotent — one ACTIVE certificate per (user, course) / (user,
 * module), enforced by partial unique indexes — and best-effort archive the
 * PDF to MinIO when configured. The PDF is otherwise generated on-demand at
 * download, so certificates work even where MinIO is unreachable.
 *
 * "Passed" is always a counted pass (non-voided — lib/assessments/passed.ts).
 */

// Unambiguous alphabet (no I, L, O, 0, 1) — codes get read aloud / typed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `MZN-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

function studentDisplayName(user: {
  fullName: string | null;
  name: string | null;
  email: string | null;
}): string {
  return user.fullName || user.name || user.email || "—";
}

function verifyUrl(code: string): string {
  const base = (env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/verify/${code}`;
}

/** Has the user a counted pass on the course's final exam? */
async function hasPassedFinalExam(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const finalExam = await assessmentsRepository.findByTypeForCourse(
    courseId,
    "final_exam",
  );
  if (!finalExam) return false;
  return attemptsRepository.hasPassed(userId, finalExam.id);
}

/**
 * Issue the course certificate if the user is eligible; idempotent. Returns
 * the active certificate (existing or new), or null when not eligible (course
 * has certs off, no final exam, not passed yet) — or when the user's course
 * certificate was revoked: re-issuing that is an admin decision, never a side
 * effect of viewing a result page.
 */
export async function issueIfEligible(userId: string, courseId: string) {
  const course = await coursesRepository.findById(courseId);
  if (!course || !course.certificateEnabled) return null;

  const latest = await certificatesRepository.findLatestForUserCourse(
    userId,
    courseId,
  );
  if (latest) return latest.revokedAt ? null : latest;

  // Full completion chain (spec 1.6): final exam passed AND all lessons
  // completed AND all published module tests passed. All three must hold.
  if (!(await hasPassedFinalExam(userId, courseId))) return null;
  const prereq = await getExamPrerequisites(userId, courseId);
  if (!prereq.unlocked) return null;

  const cert = await createAndArchive(userId, course, null);
  // Mark the enrollment complete on first issuance (best-effort). Course
  // certificates only — a module certificate is a milestone, not completion.
  if (cert) {
    try {
      await enrollmentsRepository.markCompleted(userId, courseId);
    } catch (err) {
      console.error("mark enrollment completed failed (non-fatal):", err);
    }
  }
  return cert;
}

/**
 * Issue a module certificate if the user is eligible; idempotent. Eligible =
 * the course has certificates AND module certificates on, the module has at
 * least one lesson and the user completed every one, and the module's exam
 * (published, scored) has a counted pass. Returns the active certificate, or
 * null when not eligible or when this module's certificate was revoked (an
 * admin re-issues that; it never comes back by itself).
 *
 * Called from three places, all best-effort: exam submit (a module exam
 * passed), lesson completion (the last lesson done after an earlier pass) and
 * the module exam's result page.
 */
export async function issueModuleCertificateIfEligible(
  userId: string,
  moduleId: string,
) {
  const mod = await modulesRepository.findById(moduleId);
  if (!mod) return null;
  const course = await coursesRepository.findById(mod.courseId);
  if (!course || !moduleCertificatesActive(course)) return null;

  const latest = await certificatesRepository.findLatestForUserModule(
    userId,
    moduleId,
  );
  if (latest) return latest.revokedAt ? null : latest;

  const exam = await assessmentsRepository.findForModule(moduleId);
  if (!exam || !exam.isPublished || !exam.isScored) return null;

  // Cheap check first: this runs on every lesson completion.
  if (!(await attemptsRepository.hasPassed(userId, exam.id))) return null;
  const lessons = await moduleLessonsStatus(userId, course.id, moduleId);
  if (!lessons.allComplete) return null; // also false for an empty module

  return createAndArchive(userId, course, { id: mod.id, title: mod.title });
}

type CourseRow = NonNullable<
  Awaited<ReturnType<typeof coursesRepository.findById>>
>;

/** The module a module certificate is for (id null once it was deleted). */
type ModuleRef = { id: string | null; title: LocalizedText };

/**
 * Admin override: issue a course certificate regardless of exam result
 * (idempotent). Used by the admin user-detail / certificates pages. Ignores
 * the course switches by design.
 */
export async function issueManual(userId: string, courseId: string) {
  const course = await coursesRepository.findById(courseId);
  if (!course) return null;
  // Reuse only an ACTIVE cert; a revoked one should be replaced (re-issue flow).
  const existing = await certificatesRepository.findForUserCourse(
    userId,
    courseId,
  );
  if (existing) return existing;
  return createAndArchive(userId, course, null);
}

/**
 * Admin override for a module certificate (idempotent; reuses an ACTIVE one).
 * Ignores the switches and eligibility, like issueManual.
 */
export async function issueManualModule(userId: string, moduleId: string) {
  const mod = await modulesRepository.findById(moduleId);
  if (!mod) return null;
  const course = await coursesRepository.findById(mod.courseId);
  if (!course) return null;
  const existing = await certificatesRepository.findForUserModule(userId, moduleId);
  if (existing) return existing;
  return createAndArchive(userId, course, { id: mod.id, title: mod.title });
}

/**
 * Re-issue a (just revoked) certificate as a fresh one of the SAME kind: a
 * course certificate stays a course certificate, a module certificate stays a
 * certificate for the same module. A module certificate whose module has since
 * been deleted is re-issued from its title snapshot (module_id stays null).
 */
export async function reissueLike(cert: {
  userId: string;
  courseId: string;
  kind: "course" | "module";
  moduleId: string | null;
  moduleTitle: LocalizedText | null;
}) {
  if (cert.kind === "course") return issueManual(cert.userId, cert.courseId);
  if (cert.moduleId) {
    const fresh = await issueManualModule(cert.userId, cert.moduleId);
    if (fresh) return fresh;
  }
  const course = await coursesRepository.findById(cert.courseId);
  if (!course) return null;
  return createAndArchive(cert.userId, course, {
    id: null,
    title: cert.moduleTitle ?? { uz: "—" },
  });
}

/** The ACTIVE certificate of the same kind/target, after an insert lost a race. */
async function findActive(userId: string, courseId: string, mod: ModuleRef | null) {
  if (!mod) return certificatesRepository.findForUserCourse(userId, courseId);
  if (mod.id) return certificatesRepository.findForUserModule(userId, mod.id);
  return null; // a module-less re-issue has no uniqueness to race on
}

/**
 * Create the certificate row, best-effort archive the PDF to MinIO, and notify.
 * Shared by every issue path. `mod` null = a course certificate.
 */
async function createAndArchive(
  userId: string,
  course: CourseRow,
  mod: ModuleRef | null,
) {
  const courseId = course.id;
  // Generate a unique code (retry on the rare unique-constraint collision).
  let cert = null;
  for (let attempt = 0; attempt < 3 && !cert; attempt++) {
    try {
      cert = await certificatesRepository.create({
        userId,
        courseId,
        verificationCode: generateCode(),
        kind: mod ? "module" : "course",
        moduleId: mod?.id ?? null,
        moduleTitle: mod?.title ?? null,
      });
    } catch (err) {
      // Another request may have issued concurrently (the partial unique
      // index rejected this insert) — read the winner back.
      const raced = await findActive(userId, courseId, mod);
      if (raced) return raced;
      if (attempt === 2) throw err;
    }
  }
  if (!cert) return null;

  // Best-effort archive to MinIO (in-country). Never block issuance on it.
  if (isStorageConfigured()) {
    try {
      const user = await usersRepository.findById(userId);
      if (user) {
        const locale = (user.locale ?? "uz") as Locale;
        const pdf = await generateCertificatePdf(
          pdfData(user, course.title, cert, locale),
        );
        const key = `certificates/${cert.id}.pdf`;
        await getStorageClient().putObject({
          key,
          body: pdf,
          contentType: "application/pdf",
        });
        await certificatesRepository.setPdfObjectKey(cert.id, key);
      }
    } catch (err) {
      console.error("certificate archive failed (non-fatal):", err);
    }
  }

  // Certificate-issued email (best-effort; never blocks issuance).
  if (mod) {
    await notifyModuleCertificateIssued(userId, courseId, mod.title, cert.verificationCode);
  } else {
    await notifyCertificateIssued(userId, courseId, cert.verificationCode);
  }

  return cert;
}

type CertRow = NonNullable<Awaited<ReturnType<typeof certificatesRepository.findByCode>>>;
type UserRow = NonNullable<Awaited<ReturnType<typeof usersRepository.findById>>>;

/** The PDF input for a certificate row (module title from the snapshot). */
function pdfData(
  user: UserRow,
  courseTitle: LocalizedText,
  cert: CertRow,
  locale: Locale,
) {
  return {
    studentName: studentDisplayName(user),
    courseTitle: pickLocale(courseTitle, locale),
    issuedAt: cert.issuedAt,
    verificationCode: cert.verificationCode,
    verifyUrl: verifyUrl(cert.verificationCode),
    locale,
    kind: cert.kind,
    moduleTitle:
      cert.kind === "module" && cert.moduleTitle
        ? pickLocale(cert.moduleTitle, locale)
        : undefined,
  };
}

/**
 * Build the certificate PDF bytes for a verification code. Public-by-code: the
 * code is the capability. Returns null if the code is unknown or revoked. A
 * module certificate renders from its title snapshot, so it still works after
 * the module was renamed or deleted.
 */
export async function renderCertificatePdf(
  code: string,
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const cert = await certificatesRepository.findByCode(code);
  if (!cert || cert.revokedAt) return null;

  const [user, course] = await Promise.all([
    usersRepository.findById(cert.userId),
    coursesRepository.findById(cert.courseId),
  ]);
  if (!user || !course) return null;

  const locale = (user.locale ?? "uz") as Locale;
  const bytes = await generateCertificatePdf(pdfData(user, course.title, cert, locale));
  const filename =
    cert.kind === "module"
      ? `mezon-module-certificate-${cert.verificationCode}.pdf`
      : `mezon-certificate-${cert.verificationCode}.pdf`;
  return { bytes, filename };
}

export type VerificationResult = {
  valid: boolean;
  revoked: boolean;
  studentName: string;
  courseTitle: LocalizedText;
  /** 'module' = confirms one module of the course, not course completion. */
  kind: "course" | "module";
  /** Module certificates: the title snapshot taken at issue; else null. */
  moduleTitle: LocalizedText | null;
  issuedAt: Date;
  verificationCode: string;
};

/** Public verification by code. Returns null if the code is unknown. */
export async function verifyByCode(
  code: string,
): Promise<VerificationResult | null> {
  const cert = await certificatesRepository.findByCode(code);
  if (!cert) return null;

  const [user, course] = await Promise.all([
    usersRepository.findById(cert.userId),
    coursesRepository.findById(cert.courseId),
  ]);
  if (!user || !course) return null;

  const revoked = Boolean(cert.revokedAt);
  return {
    valid: !revoked,
    revoked,
    studentName: studentDisplayName(user),
    courseTitle: course.title,
    kind: cert.kind,
    moduleTitle: cert.kind === "module" ? (cert.moduleTitle ?? { uz: "—" }) : null,
    issuedAt: cert.issuedAt,
    verificationCode: cert.verificationCode,
  };
}
