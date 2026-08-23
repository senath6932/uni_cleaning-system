ALTER TABLE "MonthlyEvaluationReport"
ADD COLUMN "attendanceHistory" JSONB;

ALTER TABLE "MonthlyTaskSummary"
ALTER COLUMN "recommendedAmount" DROP NOT NULL;
