CREATE TYPE "public"."attachment_kind" AS ENUM('pdf', 'image');--> statement-breakpoint
CREATE TYPE "public"."attachment_status" AS ENUM('uploading', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "lesson_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"title" jsonb NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"status" "attachment_status" DEFAULT 'uploading' NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_count" integer NOT NULL,
	"pages" jsonb NOT NULL,
	"slide_mime" text DEFAULT 'image/webp' NOT NULL,
	"storage_prefix" text NOT NULL,
	"allow_download" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_attachments" ADD CONSTRAINT "lesson_attachments_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attachments" ADD CONSTRAINT "lesson_attachments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_attachments_lesson_idx" ON "lesson_attachments" USING btree ("lesson_id","order_index");