CREATE TYPE "public"."application_source" AS ENUM('landing_cpss', 'landing_bim', 'landing_b2b', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('new', 'contacted', 'enrolled', 'declined');--> statement-breakpoint
CREATE TABLE "course_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"organization" text,
	"source" "application_source" DEFAULT 'landing_cpss' NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"locale" text,
	"sms_consent_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "course_applications_created_at_idx" ON "course_applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "course_applications_status_idx" ON "course_applications" USING btree ("status");