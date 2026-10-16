-- Before 0025 makes "one ACTIVE course certificate per (user, course)" a
-- database rule, neutralise any duplicates the old check-then-insert race let
-- through. Two active course certificates for the same student and course are
-- a bug by definition: keep the earliest issued (ties broken by id, so the
-- choice is deterministic) and revoke the later ones. Nothing is deleted —
-- a revoked code still verifies as "revoked", so a link already shared does
-- not turn into "not found".
UPDATE "certificates" AS c
SET "revoked_at" = now()
FROM (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "user_id", "course_id"
           ORDER BY "issued_at" ASC, "id" ASC
         ) AS rn
  FROM "certificates"
  WHERE "kind" = 'course' AND "revoked_at" IS NULL
) AS d
WHERE c."id" = d."id" AND d.rn > 1;
