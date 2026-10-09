-- Every existing lesson video becomes that lesson's Part 1, and everything
-- pinned to a moment in it (notes, bookmarks, in-video questions) is pointed
-- at that part. Runs before 0023 drops lessons.bunny_video_id.
INSERT INTO "lesson_videos" ("lesson_id", "order_index", "bunny_video_id", "duration_seconds")
SELECT "id", 0, "bunny_video_id", "duration_seconds"
FROM "lessons"
WHERE "bunny_video_id" IS NOT NULL AND btrim("bunny_video_id") <> '';
--> statement-breakpoint
UPDATE "video_questions" AS q
SET "video_id" = v."id"
FROM "lesson_videos" AS v
WHERE v."lesson_id" = q."lesson_id" AND v."order_index" = 0 AND q."video_id" IS NULL;
--> statement-breakpoint
UPDATE "notes" AS n
SET "video_id" = v."id"
FROM "lesson_videos" AS v
WHERE v."lesson_id" = n."lesson_id" AND v."order_index" = 0
  AND n."timestamp_seconds" IS NOT NULL AND n."video_id" IS NULL;
--> statement-breakpoint
-- Students who already opened a single-video lesson have, by definition,
-- opened its only part: keep their "Mark complete" unlocked.
UPDATE "lesson_progress" AS p
SET "opened_video_ids" = jsonb_build_array(v."id"::text),
    "last_video_id" = v."id"
FROM "lesson_videos" AS v
WHERE v."lesson_id" = p."lesson_id" AND v."order_index" = 0;
