ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "questions_to_serve" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "voided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "points" integer DEFAULT 1 NOT NULL;