import { z } from "zod";

const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

const optionalId = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

const optionalPositive = z
  .union([z.coerce.number().int().min(0), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === 0 || v == null ? null : Number(v)));

export const assessmentTypeSchema = z.enum([
  "lesson_quiz",
  "module_test",
  "final_exam",
  "mock_exam",
]);

export const assessmentUpsertSchema = z.object({
  type: assessmentTypeSchema,
  titleUz: z.string().trim().min(1, "Nomi shart"),
  titleRu: z.string().trim().optional(),
  moduleId: optionalId,
  lessonId: optionalId,
  timeLimitMinutes: optionalPositive, // null = untimed
  passThresholdPct: z.coerce.number().int().min(1).max(100),
  maxAttempts: optionalPositive, // null = unlimited
  attemptCooldownHours: optionalPositive, // null = none
  isScored: checkbox,
  randomize: checkbox,
  isPublished: checkbox,
  questionsToServe: optionalPositive, // null = serve all questions
});
export type AssessmentUpsertInput = z.infer<typeof assessmentUpsertSchema>;

export const questionTypeSchema = z.enum(["single", "multiple", "true_false"]);

export const questionMetaSchema = z.object({
  type: questionTypeSchema,
  promptUz: z.string().trim().min(1, "Savol matni shart"),
  promptRu: z.string().trim().optional(),
  explanationUz: z.string().trim().optional(),
  explanationRu: z.string().trim().optional(),
  points: z.coerce.number().int().min(1).max(100).catch(1),
  moduleId: optionalId, // tag to a course module for the breakdown (optional)
});
