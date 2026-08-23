CREATE TYPE "PhiMonthlyAttendanceCategory" AS ENUM (
    'HALF_DAY_EMPLOYEES',
    'HALF_DAY_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR',
    'HALF_DAY_SUPERVISORS',
    'ABSENT_EMPLOYEES',
    'ABSENT_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR',
    'ABSENT_SUPERVISORS'
);

CREATE TABLE "PhiMonthlyAttendanceReport" (
    "id" TEXT NOT NULL,
    "phiUserId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "processingError" TEXT,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "resubmittedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhiMonthlyAttendanceReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhiMonthlyAttendanceSummary" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "category" "PhiMonthlyAttendanceCategory" NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "deductionRate" DECIMAL(15,2) NOT NULL,
    "rowTotal" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhiMonthlyAttendanceSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhiMonthlyAttendanceReview" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "AdministrationDecision" NOT NULL,
    "remarks" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhiMonthlyAttendanceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhiMonthlyAttendanceReport_phiUserId_month_year_key" ON "PhiMonthlyAttendanceReport"("phiUserId", "month", "year");
CREATE INDEX "PhiMonthlyAttendanceReport_month_year_idx" ON "PhiMonthlyAttendanceReport"("month", "year");
CREATE INDEX "PhiMonthlyAttendanceReport_status_idx" ON "PhiMonthlyAttendanceReport"("status");
CREATE INDEX "PhiMonthlyAttendanceSummary_reportId_idx" ON "PhiMonthlyAttendanceSummary"("reportId");
CREATE UNIQUE INDEX "PhiMonthlyAttendanceSummary_reportId_category_key" ON "PhiMonthlyAttendanceSummary"("reportId", "category");
CREATE INDEX "PhiMonthlyAttendanceReview_reportId_idx" ON "PhiMonthlyAttendanceReview"("reportId");
CREATE INDEX "PhiMonthlyAttendanceReview_reviewerId_idx" ON "PhiMonthlyAttendanceReview"("reviewerId");
CREATE INDEX "PhiMonthlyAttendanceReview_decision_idx" ON "PhiMonthlyAttendanceReview"("decision");

ALTER TABLE "PhiMonthlyAttendanceReport" ADD CONSTRAINT "PhiMonthlyAttendanceReport_phiUserId_fkey" FOREIGN KEY ("phiUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhiMonthlyAttendanceSummary" ADD CONSTRAINT "PhiMonthlyAttendanceSummary_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PhiMonthlyAttendanceReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhiMonthlyAttendanceReview" ADD CONSTRAINT "PhiMonthlyAttendanceReview_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PhiMonthlyAttendanceReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhiMonthlyAttendanceReview" ADD CONSTRAINT "PhiMonthlyAttendanceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
