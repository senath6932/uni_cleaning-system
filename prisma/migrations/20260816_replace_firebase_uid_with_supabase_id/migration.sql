-- The user table is empty in the current database, so this safely removes the
-- Firebase-specific column and makes the application user id supplied by Supabase.
ALTER TABLE "User" DROP COLUMN IF EXISTS "firebaseUid";

ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
