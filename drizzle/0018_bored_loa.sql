ALTER TYPE "public"."notification_status" ADD VALUE 'delivered' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."notification_status" ADD VALUE 'rejected' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "provider_status" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_provider_message_id_idx" ON "notifications" USING btree ("provider_message_id");