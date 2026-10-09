CREATE TABLE "lesson_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"title" jsonb,
	"bunny_video_id" text NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "last_video_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "opened_video_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "video_id" uuid;--> statement-breakpoint
ALTER TABLE "video_questions" ADD COLUMN "video_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_videos" ADD CONSTRAINT "lesson_videos_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_videos_lesson_idx" ON "lesson_videos" USING btree ("lesson_id","order_index");--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_last_video_id_lesson_videos_id_fk" FOREIGN KEY ("last_video_id") REFERENCES "public"."lesson_videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_video_id_lesson_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."lesson_videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_questions" ADD CONSTRAINT "video_questions_video_id_lesson_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."lesson_videos"("id") ON DELETE cascade ON UPDATE no action;