import { Prisma, type PrismaClient, type UserRole, type Prisma as PrismaTypes } from "@/app/generated/prisma/client";
import { PaymentRecommendationError } from "@/lib/payment-recommendations";
export { PaymentRecommendationError } from "@/lib/payment-recommendations";

type Actor = { id: string; role: UserRole; active: boolean };
const locationSelect = { id: true, code: true, name: true } satisfies PrismaTypes.LocationSelect;
const recommendationSelect = {
  id: true, status: true, remarks: true, createdAt: true, finalizedAt: true, finalizationRemarks: true,
  overallRecommendedPayment: true, locationCleaningTotal: true, locationAttendanceTotal: true, locationGrandTotal: true,
  createdBy: { select: { name: true } }, finalizedBy: { select: { name: true } },
  report: { select: { id: true, month: true, year: true, status: true, isComplete: true, processingError: true, attendanceHistory: true, location: { select: locationSelect }, administrationReviews: { orderBy: { reviewedAt: "asc" }, select: { decision: true, remarks: true, reviewedAt: true, reviewer: { select: { name: true } } } }, taskSummaries: { orderBy: { createdAt: "asc" }, select: { id: true, taskNameSnapshot: true, categorySnapshot: true, frequencySnapshot: true, passedOccurrences: true, failedOccurrences: true, notApplicableOccurrences: true, completionPercentage: true, allocatedAmount: true, evaluationHistory: true, taskRemarks: true } } } },
  taskCalculations: { orderBy: { createdAt: "asc" }, select: { id: true, originalAmount: true, recommendationAmount: true, completionPercentage: true, recommendedAmount: true, monthlyTaskSummaryId: true } },
  additionalTasks: { orderBy: { createdAt: "asc" }, select: { id: true, locationId: true, taskName: true, category: true, allocatedAmount: true, completionPercentage: true, recommendedAmount: true, remark: true } },
} satisfies PrismaTypes.PaymentRecommendationSelect;

function assertGaa(actor: Actor) { if (!actor.active || actor.role !== "GAA") throw new PaymentRecommendationError("ACCESS_DENIED", "Only active GAA users can access final reports.", 403); }

export async function getFinalReport(prisma: Pick<PrismaClient, "paymentRecommendation" | "activityLog">, actor: Actor, year: number, month: number) {
  assertGaa(actor); if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new PaymentRecommendationError("NOT_FOUND", "A valid reporting month is required.");
  const recommendations = await prisma.paymentRecommendation.findMany({ where: { status: "FINALIZED", report: { year, month, status: "ADMIN_APPROVED" } }, orderBy: { report: { location: { code: "asc" } } }, select: recommendationSelect });
  const approvedCount = await prisma.paymentRecommendation.count({ where: { report: { year, month, status: "ADMIN_APPROVED" } } });
  if (!approvedCount || recommendations.length !== approvedCount) throw new PaymentRecommendationError("INCOMPLETE_REPORT", "All Administration-approved location recommendations must be finalized before generating the final report.", 409);
  const totals = recommendations.reduce((result, recommendation) => ({ cleaning: result.cleaning.add(recommendation.locationCleaningTotal), additional: result.additional.add(recommendation.additionalTasks.reduce((sum, task) => sum.add(task.recommendedAmount), new Prisma.Decimal(0))) }), { cleaning: new Prisma.Decimal(0), additional: new Prisma.Decimal(0) });
  const history = await prisma.activityLog.findMany({ where: { OR: [{ entityType: "PaymentRecommendation", entityId: { in: recommendations.map((item) => item.id) } }, { entityType: "MonthlyEvaluationReport", entityId: { in: recommendations.map((item) => item.report.id) } }] }, orderBy: { timestamp: "asc" }, select: { action: true, description: true, timestamp: true, user: { select: { name: true } }, metadata: true } });
  return { year, month, recommendations, history, totals: { cleaning: totals.cleaning.toDecimalPlaces(2), additional: totals.additional.toDecimalPlaces(2), overall: totals.cleaning.add(totals.additional).toDecimalPlaces(2) } };
}
