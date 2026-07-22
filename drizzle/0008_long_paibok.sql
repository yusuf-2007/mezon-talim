ALTER TABLE "notes" ADD COLUMN "timestamp_seconds" integer;--> statement-breakpoint
INSERT INTO "notes" ("user_id", "lesson_id", "body", "timestamp_seconds", "created_at", "updated_at")
SELECT "user_id", "lesson_id", COALESCE(NULLIF("label", ''), ''), "timestamp_seconds", "created_at", "created_at"
FROM "bookmarks";--> statement-breakpoint
DROP TABLE "bookmarks" CASCADE;
