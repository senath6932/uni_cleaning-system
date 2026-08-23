ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DAILY_EVALUATION_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_EVALUATION_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_EVALUATION_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_EVALUATION_FINALIZED';

CREATE TABLE "DailyAttendanceEvaluation" (
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

CREATE UNIQUE INDEX "DailyAttendanceEvaluation_locationId_attendanceDate_key" ON "DailyAttendanceEvaluation"("locationId", "attendanceDate");
CREATE INDEX "DailyAttendanceEvaluation_locationId_idx" ON "DailyAttendanceEvaluation"("locationId");
CREATE INDEX "DailyAttendanceEvaluation_phiUserId_idx" ON "DailyAttendanceEvaluation"("phiUserId");
CREATE INDEX "DailyAttendanceEvaluation_attendanceDate_idx" ON "DailyAttendanceEvaluation"("attendanceDate");

ALTER TABLE "DailyAttendanceEvaluation" ADD CONSTRAINT "DailyAttendanceEvaluation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyAttendanceEvaluation" ADD CONSTRAINT "DailyAttendanceEvaluation_phiUserId_fkey" FOREIGN KEY ("phiUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
