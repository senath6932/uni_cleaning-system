ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PAYMENT_RECOMMENDATION_SUBMITTED';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'PAYMENT_RECOMMENDATION_SUBMITTED';
ALTER TYPE "PaymentRecommendationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "PaymentRecommendationStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PAYMENT_RECOMMENDATION_FINALIZED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'FINAL_REPORT_PDF_GENERATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'FINAL_REPORT_EXCEL_GENERATED';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'PAYMENT_RECOMMENDATION_FINALIZED';

ALTER TABLE "PaymentRecommendation"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ADD COLUMN "submittedByUserId" TEXT,
  ADD COLUMN "remarks" TEXT,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedByUserId" TEXT,
  ADD COLUMN "finalizationRemarks" TEXT;

ALTER TABLE "PaymentRecommendation"
  ADD CONSTRAINT "PaymentRecommendation_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaymentRecommendation_submittedByUserId_idx" ON "PaymentRecommendation"("submittedByUserId");
CREATE INDEX "PaymentRecommendation_finalizedByUserId_idx" ON "PaymentRecommendation"("finalizedByUserId");

ALTER TABLE "PaymentRecommendation"
  ADD CONSTRAINT "PaymentRecommendation_finalizedByUserId_fkey"
  FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
