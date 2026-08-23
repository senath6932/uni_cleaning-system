ALTER TABLE "MonthlyEvaluationReport"
  ADD COLUMN IF NOT EXISTS "attendanceHistory" JSONB;

ALTER TABLE "PaymentRecommendation"
  ADD COLUMN IF NOT EXISTS "submittedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalizedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizationRemarks" TEXT;

ALTER TABLE "PaymentRecommendation"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS "PaymentRecommendation_submittedByUserId_idx"
  ON "PaymentRecommendation"("submittedByUserId");

CREATE INDEX IF NOT EXISTS "PaymentRecommendation_finalizedByUserId_idx"
  ON "PaymentRecommendation"("finalizedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecommendation_submittedByUserId_fkey'
  ) THEN
    ALTER TABLE "PaymentRecommendation"
      ADD CONSTRAINT "PaymentRecommendation_submittedByUserId_fkey"
      FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecommendation_finalizedByUserId_fkey'
  ) THEN
    ALTER TABLE "PaymentRecommendation"
      ADD CONSTRAINT "PaymentRecommendation_finalizedByUserId_fkey"
      FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DailyAttendanceEvaluation" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "phiUserId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL,
  "totalPresentCount" INTEGER NOT NULL,
  "remark" TEXT,
  "finalized" BOOLEAN NOT NULL DEFAULT false,
  "finalizedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyAttendanceEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyAttendanceEvaluation_locationId_attendanceDate_key"
  ON "DailyAttendanceEvaluation"("locationId", "attendanceDate");

CREATE INDEX IF NOT EXISTS "DailyAttendanceEvaluation_locationId_idx"
  ON "DailyAttendanceEvaluation"("locationId");

CREATE INDEX IF NOT EXISTS "DailyAttendanceEvaluation_phiUserId_idx"
  ON "DailyAttendanceEvaluation"("phiUserId");

CREATE INDEX IF NOT EXISTS "DailyAttendanceEvaluation_attendanceDate_idx"
  ON "DailyAttendanceEvaluation"("attendanceDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyAttendanceEvaluation_locationId_fkey'
  ) THEN
    ALTER TABLE "DailyAttendanceEvaluation"
      ADD CONSTRAINT "DailyAttendanceEvaluation_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyAttendanceEvaluation_phiUserId_fkey'
  ) THEN
    ALTER TABLE "DailyAttendanceEvaluation"
      ADD CONSTRAINT "DailyAttendanceEvaluation_phiUserId_fkey"
      FOREIGN KEY ("phiUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
