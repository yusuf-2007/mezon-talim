import {
  boolean,
  integer,
  jsonb,
  pgTable,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons, modules } from "./catalog";
import {
  assessmentType,
  createdAt,
  type LocalizedText,
  questionType,
  timestamptz,
  updatedAt,
} from "./_shared";

/**
 * Assessments: lesson quizzes + self-assessment, module tests, final exam
 * (timed, attempt limits, 70% pass), and one unscored mock exam.
 */
export const assessments = pgTable("assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: assessmentType("type").notNull(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  moduleId: uuid("module_id").references(() => modules.id, {
    onDelete: "cascade",
  }), // module_test
  lessonId: uuid("lesson_id").references(() => lessons.id, {
    onDelete: "cascade",
  }), // lesson_quiz
  title: jsonb("title").$type<LocalizedText>().notNull(),
  timeLimitSeconds: integer("time_limit_seconds"), // null = untimed (B14)
  passThresholdPct: integer("pass_threshold_pct").notNull().default(70), // B13
  maxAttempts: integer("max_attempts"), // e.g. 3 for final (B15)
  attemptCooldownHours: integer("attempt_cooldown_hours"), // e.g. 24 (B15)
  isScored: boolean("is_scored").notNull().default(true), // false for mock (B17)
  randomize: boolean("randomize").notNull().default(false), // light integrity (TBD #4)
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  type: questionType("type").notNull(),
  prompt: jsonb("prompt").$type<LocalizedText>().notNull(),
  explanation: jsonb("explanation").$type<LocalizedText>(), // shown in review (B16)
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const questionOptions = pgTable("question_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  label: jsonb("label").$type<LocalizedText>().notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    startedAt: timestamptz("started_at").defaultNow().notNull(),
    submittedAt: timestamptz("submitted_at"),
    scorePct: integer("score_pct"),
    passed: boolean("passed"),
  },
  (t) => [
    unique("attempts_user_assessment_no_uq").on(
      t.userId,
      t.assessmentId,
      t.attemptNo,
    ),
  ],
);

export const attemptAnswers = pgTable("attempt_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  selectedOptionIds: jsonb("selected_option_ids").$type<string[]>().notNull(),
  isCorrect: boolean("is_correct"),
});
