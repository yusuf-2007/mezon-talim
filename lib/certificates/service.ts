import "server-only";
import { randomBytes } from "node:crypto";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { usersRepository } from "@/lib/db/repositories/users";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { getExamPrerequisites } from "@/lib/assessments/gating";
import { getStorageClient, isStorageConfigured } from "@/lib/storage";
import { notifyCertificateIssued } from "@/lib/notifications/service";
import { generateCertificatePdf } from "./pdf";
import { pickLocale } from "@/lib/i18n/localized";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Certificate issuance & verification (TBD #2: Mezon's own completion cert).
 *
 * Issuance is gated on a *passing final-exam attempt* for a certificate-enabled
 * course, idempotent (one per user+course), and best-effort archives the PDF to
 * MinIO when configured. The PDF is otherwise generated on-demand at download,
 * so certificates work even where MinIO is unreachable (e.g. preview deploys).
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

/** Has the user passed the course's final exam? */
async function hasPassedFinalExam(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const finalExam = await assessmentsRepository.findByTypeForCourse(
    courseId,
    "final_exam",
  );
  if (!finalExam) return false;
  const attempts = await attemptsRepository.listForUser(userId, finalExam.id);
  return attempts.some((a) => a.passed);
}

/**
 * Issue a certificate if the user is eligible; idempotent. Returns the existing
 * or newly-created certificate, or null when not eligible (course has certs off,
 * no final exam, or not passed yet).
 */
export async function issueIfEligible(userId: string, courseId: string) {
  const course = await coursesRepository.findById(courseId);
  if (!course || !course.certificateEnabled) return null;

  const existing = await certificatesRepository.findForUserCourse(
    userId,
    courseId,
  );
  if (existing) return existing;

  // Full completion chain (spec 1.6): final exam passed AND all lessons
  // completed AND all published module tests passed. All three must hold.
  if (!(await hasPassedFinalExam(userId, courseId))) return null;
  const prereq = await getExamPrerequisites(userId, courseId);
  if (!prereq.unlocked) return null;

  const cert = await createAndArchive(userId, courseId, course);
  // Mark the enrollment complete on first issuance (best-effort).
  if (cert) {
    try {
      await enrollmentsRepository.markCompleted(userId, courseId);
    } catch (err) {
      console.error("mark enrollment completed failed (non-fatal):", err);
    }
  }
  return cert;
}

type CourseRow = NonNullable<
  Awaited<ReturnType<typeof coursesRepository.findById>>
>;

/**
 * Admin override: issue a certificate regardless of exam result (idempotent).
 * Used by the admin user-detail / certificates pages.
 */
export async function issueManual(userId: string, courseId: string) {
  const course = await coursesRepository.findById(courseId);
  if (!course) return null;
  const existing = await certificatesRepository.findForUserCourse(
    userId,
    courseId,
  );
  // Reuse only an ACTIVE cert; a revoked one should be replaced (re-issue flow).
  if (existing && !existing.revokedAt) return existing;
  return createAndArchive(userId, courseId, course);
}

/**
 * Create the certificate row, best-effort archive the PDF to MinIO, and notify.
 * Shared by the eligible (exam-pass) and manual (admin) issue paths.
 */
async function createAndArchive(
  userId: string,
  courseId: string,
  course: CourseRow,
) {
  // Generate a unique code (retry on the rare unique-constraint collision).
  let cert = null;
  for (let attempt = 0; attempt < 3 && !cert; attempt++) {
    try {
      cert = await certificatesRepository.create({
        userId,
        courseId,
        verificationCode: generateCode(),
      });
    } catch (err) {
      // Another request may have issued concurrently — re-check.
      const raced = await certificatesRepository.findForUserCourse(
        userId,
        courseId,
      );
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
        const pdf = await generateCertificatePdf({
          studentName: studentDisplayName(user),
          courseTitle: pickLocale(course.title, locale),
          issuedAt: cert.issuedAt,
          verificationCode: cert.verificationCode,
          verifyUrl: verifyUrl(cert.verificationCode),
          locale,
        });
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
  await notifyCertificateIssued(userId, courseId, cert.verificationCode);

  return cert;
}

/**
 * Build the certificate PDF bytes for a verification code. Public-by-code: the
 * code is the capability. Returns null if the code is unknown or revoked.
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
  const bytes = await generateCertificatePdf({
    studentName: studentDisplayName(user),
    courseTitle: pickLocale(course.title, locale),
    issuedAt: cert.issuedAt,
    verificationCode: cert.verificationCode,
    verifyUrl: verifyUrl(cert.verificationCode),
    locale,
  });
  return { bytes, filename: `mezon-certificate-${cert.verificationCode}.pdf` };
}

export type VerificationResult = {
  valid: boolean;
  revoked: boolean;
  studentName: string;
  courseTitle: import("@/lib/db/schema").LocalizedText;
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
    issuedAt: cert.issuedAt,
    verificationCode: cert.verificationCode,
  };
}
