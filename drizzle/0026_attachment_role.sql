CREATE TYPE "public"."attachment_role" AS ENUM('slides', 'document');--> statement-breakpoint
ALTER TABLE "lesson_attachments" ADD COLUMN "role" "attachment_role" DEFAULT 'slides' NOT NULL;--> statement-breakpoint
-- Existing uploads: a portrait PDF (first page taller than wide) is a document
-- (terminology, reading); everything else stays a slide deck.
UPDATE "lesson_attachments" SET "role" = 'document'
WHERE "kind" = 'pdf'
  AND jsonb_array_length("pages") > 0
  AND ("pages"->0->>'h')::numeric > ("pages"->0->>'w')::numeric;
