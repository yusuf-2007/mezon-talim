import { z } from "zod";

/** Form checkbox/switch: present ("on"/"true") → true, missing → false. */
const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

/**
 * Content validation schemas (Studio authoring). Validated at every server
 * action boundary — CLAUDE.md §8. Localized fields require Uzbek (launch locale)
 * and accept optional Russian.
 */

/** Required-uz, optional-ru localized text. */
export const localizedRequired = z.object({
  uz: z.string().trim().min(1, "Uzbekcha matn kiritilishi shart"),
  ru: z.string().trim().optional(),
});

/** Fully-optional localized text (e.g. summary/description/body). */
export const localizedOptional = z.object({
  uz: z.string().trim().optional(),
  ru: z.string().trim().optional(),
});

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: faqat kichik harf, raqam va '-'");

export const courseStatusSchema = z.enum(["draft", "published", "archived"]);

// ── Course ───────────────────────────────────────────────────────────────────

export const courseUpsertSchema = z.object({
  slug: slugSchema,
  titleUz: z.string().trim().min(1, "Kurs nomi shart"),
  titleRu: z.string().trim().optional(),
  summaryUz: z.string().trim().optional(),
  summaryRu: z.string().trim().optional(),
  descriptionUz: z.string().trim().optional(),
  descriptionRu: z.string().trim().optional(),
  coverUrl: z.union([z.url(), z.literal("")]).optional(),
  // Price entered in so'm in the UI; converted to integer tiyin server-side.
  priceSom: z.coerce.number().int().min(0).max(100_000_000),
  accessDurationDays: z.coerce.number().int().min(1).max(3650),
  passThresholdPct: z.coerce.number().int().min(1).max(100),
  certificateEnabled: checkbox,
});
export type CourseUpsertInput = z.infer<typeof courseUpsertSchema>;

// ── Module ───────────────────────────────────────────────────────────────────

export const moduleUpsertSchema = z.object({
  titleUz: z.string().trim().min(1, "Modul nomi shart"),
  titleRu: z.string().trim().optional(),
});
export type ModuleUpsertInput = z.infer<typeof moduleUpsertSchema>;

// ── Lesson ───────────────────────────────────────────────────────────────────

export const lessonUpsertSchema = z.object({
  titleUz: z.string().trim().min(1, "Dars nomi shart"),
  titleRu: z.string().trim().optional(),
  bodyUz: z.string().trim().optional(),
  bodyRu: z.string().trim().optional(),
  bunnyVideoId: z.string().trim().optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
  isPreview: checkbox,
});
export type LessonUpsertInput = z.infer<typeof lessonUpsertSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.uuid()).min(1),
});
