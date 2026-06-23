-- Enabled on first DB init (mounted into docker-entrypoint-initdb.d).
-- citext powers case-insensitive emails; pgcrypto backs gen_random_uuid()
-- (built into core on PG13+, but enabling is harmless and explicit).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
