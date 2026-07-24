CREATE TABLE "video_question_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_question_responses_uq" UNIQUE("question_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "video_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"timestamp_seconds" integer NOT NULL,
	"prompt" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_question_responses" ADD CONSTRAINT "video_question_responses_question_id_video_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."video_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_question_responses" ADD CONSTRAINT "video_question_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_questions" ADD CONSTRAINT "video_questions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_questions_lesson_idx" ON "video_questions" USING btree ("lesson_id","timestamp_seconds");