CREATE TYPE "public"."certificate_kind" AS ENUM('course', 'module');--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "module_certificates_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "kind" "certificate_kind" DEFAULT 'course' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "module_id" uuid;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "module_title" jsonb;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;