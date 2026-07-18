CREATE TYPE "public"."occupation" AS ENUM('student', 'business_owner', 'corporate_employee', 'educator', 'other');--> statement-breakpoint
CREATE TABLE "audience_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"occupation" "occupation",
	"landing_path" text,
	"referrer" text,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "occupation" "occupation";