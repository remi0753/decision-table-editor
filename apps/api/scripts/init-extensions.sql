-- Extensions required by [design_p3_schema.md].
--   citext   : case-insensitive emails (user / invitation tables)
--   pgcrypto : gen_random_uuid() fallback (uuidv7 in PG18 is built-in)
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
