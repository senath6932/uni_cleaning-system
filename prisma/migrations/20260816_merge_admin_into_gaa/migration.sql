-- Safely convert existing ADMIN users to GAA before narrowing the enum.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'UserRole'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'User'
  ) THEN
    UPDATE "User"
    SET "role" = 'GAA'
    WHERE "role"::text = 'ADMIN';

    ALTER TYPE "UserRole" RENAME TO "UserRole_old";

    CREATE TYPE "UserRole" AS ENUM (
      'GAA',
      'EVALUATING_OFFICER',
      'PHI',
      'ADMINISTRATION_OFFICER',
      'VICE_CHANCELLOR'
    );

    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "UserRole"
      USING CASE
        WHEN "role"::text = 'ADMIN' THEN 'GAA'::"UserRole"
        ELSE "role"::text::"UserRole"
      END;

    DROP TYPE "UserRole_old";
  END IF;
END $$;
