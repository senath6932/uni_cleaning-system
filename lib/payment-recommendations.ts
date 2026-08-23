import { Prisma, type PrismaClient, type UserRole } from "@/app/generated/prisma/client";

type Actor = { id: string; role: UserRole; active: boolean };
type DecimalLike = Prisma.Decimal;
export type PaymentRecommendationErrorCode = "ACCESS_DENIED" | "NOT_ELIGIBLE" | "NOT_FOUND" | "LOCKED" | "INVALID_AMOUNT" | "INVALID_COMPLETION" | "REMARKS_REQUIRED" | "INCOMPLETE_REPORT";

export class PaymentRecommendationError extends Error {
  constructor(public code: PaymentRecommendationErrorCode, message: string, public status = 400) { super(message); this.name = "PaymentRecommendationError"; }
}

const recommendationSelect = {
  id: true, reportId: true, status: true, version: true, locationCleaningTotal: true, locationAttendanceTotal: true,
  locationGrandTotal: true, overallRecommendedPayment: true, sentToVcAt: true, submittedByUserId: true, remarks: true, createdAt: true, updatedAt: true,
  report: { select: { id: true, month: true, year: true, status: true, isComplete: true, processingError: true, attendanceHistory: true, location: { select: { id: true, code: true, name: true } } } },
  taskCalculations: { orderBy: { createdAt: "asc" }, select: { id: true, locationTaskId: true, originalAmount: true, recommendationAmount: true, completionPercentage: true, recommendedAmount: true, changedAt: true, changeReason: true, monthlyTaskSummary: { select: { id: true, taskNameSnapshot: true, categorySnapshot: true, frequencySnapshot: true } } } },
  additionalTasks: { orderBy: { createdAt: "asc" }, select: { id: true, locationId: true, taskName: true, category: true, allocatedAmount: true, completionPercentage: true, recommendedAmount: true, remark: true, isAdditional: true } },
} satisfies Prisma.PaymentRecommendationSelect;

function assertGaa(actor: Actor) { if (!actor.active || actor.role !== "GAA") throw new PaymentRecommendationError("ACCESS_DENIED", "Only active GAA users can manage payment recommendations.", 403); }
function decimal(value: string | number | DecimalLike) { try { return new Prisma.Decimal(value); } catch { throw new PaymentRecommendationError("INVALID_AMOUNT", "Enter a valid non-negative monetary amount."); } }
function amount(value: string | number | DecimalLike) { const result = decimal(value); if (result.isNegative() || !result.isFinite()) throw new PaymentRecommendationError("INVALID_AMOUNT", "Amount must be a valid non-negative value."); return result.toDecimalPlaces(2); }
function completion(value: string | number | DecimalLike) { const result = decimal(value); if (result.isNegative() || result.gt(100)) throw new PaymentRecommendationError("INVALID_COMPLETION", "Completion percentage must be between 0 and 100."); return result.toDecimalPlaces(2); }
function recommended(allocation: DecimalLike, percentage: DecimalLike) { return allocation.mul(percentage).div(100).toDecimalPlaces(2); }
export function calculateTaskRecommendedAmount(allocationInput: string, completionInput: string) { return recommended(amount(allocationInput), completion(completionInput)); }
function metadata(value: Record<string, unknown>) { return value as Prisma.InputJsonValue; }

export async function listGaaEligibleReports(prisma: Pick<PrismaClient, "monthlyEvaluationReport">, actor: Actor) {
  assertGaa(actor);
  return prisma.monthlyEvaluationReport.findMany({ where: { status: "ADMIN_APPROVED" }, orderBy: [{ year: "desc" }, { month: "desc" }, { location: { code: "asc" } }], select: { id: true, month: true, year: true, status: true, location: { select: { id: true, code: true, name: true } }, paymentRecommendation: { select: { id: true, status: true, overallRecommendedPayment: true, createdAt: true } } } });
}

export async function getPaymentRecommendation(prisma: Pick<PrismaClient, "paymentRecommendation">, actor: Actor, id: string) {
  assertGaa(actor);
  return prisma.paymentRecommendation.findUnique({ where: { id }, select: recommendationSelect });
}

export async function createPaymentRecommendation(prisma: Pick<PrismaClient, "monthlyEvaluationReport" | "paymentRecommendation" | "$transaction">, actor: Actor, reportId: string) {
  assertGaa(actor);
  try {
    return await prisma.$transaction(async (tx) => {
      const report = await tx.monthlyEvaluationReport.findUnique({ where: { id: reportId }, select: { id: true, status: true, isComplete: true, processingError: true, taskSummaries: { orderBy: { createdAt: "asc" }, select: { id: true, locationTaskId: true, allocatedAmount: true, completionPercentage: true, taskNameSnapshot: true } } } });
      if (!report) throw new PaymentRecommendationError("NOT_FOUND", "Monthly report was not found.", 404);
      if (report.status !== "ADMIN_APPROVED") throw new PaymentRecommendationError("NOT_ELIGIBLE", "Only Administration-approved reports can receive a payment recommendation.", 409);
      if (!report.isComplete || report.processingError || report.taskSummaries.some((task) => task.allocatedAmount == null || task.completionPercentage == null)) throw new PaymentRecommendationError("INCOMPLETE_REPORT", "This approved report is incomplete and cannot be recommended.", 409);
      const existing = await tx.paymentRecommendation.findUnique({ where: { reportId }, select: { id: true } });
      if (existing) return { id: existing.id, created: false };
      const calculations = report.taskSummaries.map((task) => ({ originalAmount: task.allocatedAmount, recommendationAmount: task.allocatedAmount, completionPercentage: task.completionPercentage, recommendedAmount: recommended(task.allocatedAmount, task.completionPercentage), locationTaskId: task.locationTaskId, monthlyTaskSummaryId: task.id }));
      const total = calculations.reduce((sum, task) => sum.add(task.recommendedAmount), new Prisma.Decimal(0)).toDecimalPlaces(2);
      const recommendation = await tx.paymentRecommendation.create({ data: { reportId, createdByUserId: actor.id, status: "DRAFT", locationCleaningTotal: total, locationAttendanceTotal: new Prisma.Decimal(0), locationGrandTotal: total, overallRecommendedPayment: total, taskCalculations: { create: calculations } }, select: { id: true } });
      await tx.activityLog.create({ data: { userId: actor.id, action: "PAYMENT_RECOMMENDATION_CREATED", entityType: "PaymentRecommendation", entityId: recommendation.id, description: "Payment recommendation draft created.", metadata: metadata({ reportId, total: total.toFixed(2) }) } });
      return { id: recommendation.id, created: true };
    });
  } catch (error) { if (error instanceof PaymentRecommendationError) throw error; if ((error as { code?: string }).code === "P2002") { const existing = await prisma.paymentRecommendation.findUnique({ where: { reportId }, select: { id: true } }); if (existing) return { id: existing.id, created: false }; } throw error; }
}

async function recalculate(tx: Prisma.TransactionClient, recommendationId: string) {
  const [tasks, additional] = await Promise.all([tx.paymentTaskCalculation.findMany({ where: { recommendationId }, select: { recommendedAmount: true } }), tx.additionalCleaningTask.findMany({ where: { recommendationId }, select: { recommendedAmount: true } })]);
  const taskTotal = tasks.reduce((sum, task) => sum.add(task.recommendedAmount), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const additionalTotal = additional.reduce((sum, task) => sum.add(task.recommendedAmount), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const total = taskTotal.add(additionalTotal).toDecimalPlaces(2);
  await tx.paymentRecommendation.update({ where: { id: recommendationId }, data: { locationCleaningTotal: taskTotal, locationGrandTotal: total, overallRecommendedPayment: total } });
  return { taskTotal, additionalTotal, total };
}

export async function updateRecommendationAllocation(prisma: Pick<PrismaClient, "paymentRecommendation" | "$transaction">, actor: Actor, recommendationId: string, calculationId: string, newAmountInput: string, reasonInput: string) {
  assertGaa(actor); const newAmount = amount(newAmountInput); const reason = reasonInput.trim(); if (!reason) throw new PaymentRecommendationError("REMARKS_REQUIRED", "A reason is required for allocation changes.");
  return prisma.$transaction(async (tx) => { const recommendation = await tx.paymentRecommendation.findUnique({ where: { id: recommendationId }, select: { id: true, status: true } }); if (!recommendation) throw new PaymentRecommendationError("NOT_FOUND", "Recommendation was not found.", 404); if (recommendation.status !== "DRAFT") throw new PaymentRecommendationError("LOCKED", "Only draft recommendations can be edited.", 409); const current = await tx.paymentTaskCalculation.findUnique({ where: { id: calculationId }, select: { id: true, recommendationId: true, originalAmount: true, completionPercentage: true, locationTaskId: true } }); if (!current || current.recommendationId !== recommendationId) throw new PaymentRecommendationError("NOT_FOUND", "Task calculation was not found.", 404); const nextRecommended = recommended(newAmount, current.completionPercentage); await tx.paymentTaskCalculation.update({ where: { id: calculationId }, data: { recommendationAmount: newAmount, recommendedAmount: nextRecommended, changedById: actor.id, changedAt: new Date(), changeReason: reason } }); await tx.activityLog.create({ data: { userId: actor.id, action: "PAYMENT_ALLOCATION_UPDATED", entityType: "PaymentRecommendation", entityId: recommendationId, description: "Payment recommendation allocation updated.", metadata: metadata({ recommendationId, calculationId, locationTaskId: current.locationTaskId, originalAmount: current.originalAmount.toFixed(2), recommendationAmount: newAmount.toFixed(2), changeReason: reason }) } }); return recalculate(tx, recommendationId); });
}

export async function addAdditionalRecommendationTask(prisma: Pick<PrismaClient, "paymentRecommendation" | "$transaction">, actor: Actor, recommendationId: string, input: { taskName: string; category: "DAILY" | "WEEKLY" | "MONTHLY"; allocatedAmount: string; completionPercentage: string; remark: string }) {
  assertGaa(actor); const taskName = input.taskName.trim(); const remark = input.remark.trim(); if (!taskName || !remark) throw new PaymentRecommendationError("REMARKS_REQUIRED", "Task name and remark are required."); const allocatedAmount = amount(input.allocatedAmount); const completionPercentage = completion(input.completionPercentage);
  return prisma.$transaction(async (tx) => { const recommendation = await tx.paymentRecommendation.findUnique({ where: { id: recommendationId }, select: { id: true, report: { select: { status: true, locationId: true } }, status: true } }); if (!recommendation) throw new PaymentRecommendationError("NOT_FOUND", "Recommendation was not found.", 404); if (recommendation.report.status !== "ADMIN_APPROVED") throw new PaymentRecommendationError("NOT_ELIGIBLE", "The approved report is no longer eligible.", 409); if (recommendation.status !== "DRAFT") throw new PaymentRecommendationError("LOCKED", "Only draft recommendations can be edited.", 409); const recommendedAmount = recommended(allocatedAmount, completionPercentage); const task = await tx.additionalCleaningTask.create({ data: { recommendationId, locationId: recommendation.report.locationId, taskName, category: input.category, allocatedAmount, completionPercentage, recommendedAmount, remark, createdByUserId: actor.id } }); await tx.activityLog.create({ data: { userId: actor.id, action: "ADDITIONAL_TASK_ADDED", entityType: "PaymentRecommendation", entityId: recommendationId, description: "Additional cleaning task added to payment recommendation.", metadata: metadata({ recommendationId, taskId: task.id, taskName, allocatedAmount: allocatedAmount.toFixed(2), completionPercentage: completionPercentage.toFixed(2), recommendedAmount: recommendedAmount.toFixed(2), remark }) } }); await recalculate(tx, recommendationId); return task; });
}

export async function updateRecommendationRemarks(prisma: Pick<PrismaClient, "paymentRecommendation">, actor: Actor, recommendationId: string, remarksInput: string) { assertGaa(actor); const recommendation = await prisma.paymentRecommendation.findUnique({ where: { id: recommendationId }, select: { status: true } }); if (!recommendation) throw new PaymentRecommendationError("NOT_FOUND", "Recommendation was not found.", 404); if (recommendation.status !== "DRAFT") throw new PaymentRecommendationError("LOCKED", "Only draft recommendations can be edited.", 409); return prisma.paymentRecommendation.update({ where: { id: recommendationId }, data: { remarks: remarksInput.trim() || null }, select: { id: true, remarks: true } }); }

export async function submitPaymentRecommendation(prisma: Pick<PrismaClient, "paymentRecommendation" | "user" | "$transaction">, actor: Actor, recommendationId: string) {
  assertGaa(actor);
  return prisma.$transaction(async (tx) => { const recommendation = await tx.paymentRecommendation.findUnique({ where: { id: recommendationId }, select: { id: true, reportId: true, status: true, report: { select: { status: true, month: true, year: true, location: { select: { name: true } } } }, taskCalculations: { select: { recommendationAmount: true, completionPercentage: true, recommendedAmount: true, monthlyTaskSummary: { select: { id: true } } } } } }); if (!recommendation) throw new PaymentRecommendationError("NOT_FOUND", "Recommendation was not found.", 404); if (recommendation.status !== "DRAFT") throw new PaymentRecommendationError("LOCKED", "Only draft recommendations can be submitted.", 409); if (recommendation.report.status !== "ADMIN_APPROVED" || recommendation.taskCalculations.length === 0 || recommendation.taskCalculations.some((task) => task.recommendationAmount.isNegative() || task.completionPercentage.isNegative() || task.completionPercentage.gt(100))) throw new PaymentRecommendationError("INCOMPLETE_REPORT", "The recommendation is not complete or its report is no longer approved.", 409); const updated = await tx.paymentRecommendation.update({ where: { id: recommendationId, status: "DRAFT" }, data: { status: "VC_PENDING", sentToVcAt: new Date(), submittedByUserId: actor.id }, select: { id: true, status: true } }); await tx.activityLog.create({ data: { userId: actor.id, action: "PAYMENT_RECOMMENDATION_SUBMITTED", entityType: "PaymentRecommendation", entityId: recommendationId, description: "Payment recommendation submitted to the Vice Chancellor.", metadata: metadata({ reportId: recommendation.reportId, month: recommendation.report.month, year: recommendation.report.year }) } }); const vcs = await tx.user.findMany({ where: { active: true, role: "VICE_CHANCELLOR" }, select: { id: true } }); for (const vc of vcs) await tx.notification.create({ data: { recipientUserId: vc.id, event: "PAYMENT_RECOMMENDATION_SUBMITTED", title: "Payment Recommendation Submitted", message: `${recommendation.report.location.name} payment recommendation is pending Vice Chancellor review.`, entityType: "PaymentRecommendation", entityId: recommendationId, dedupeKey: `payment-recommendation-submitted:${recommendationId}:${vc.id}`, metadata: metadata({ recommendationId, reportId: recommendation.reportId, status: "VC_PENDING" }) } }); return updated; });
}

export async function finalizePaymentRecommendation(prisma: Pick<PrismaClient, "paymentRecommendation" | "$transaction">, actor: Actor, recommendationId: string, remarksInput = "") {
  assertGaa(actor);
  const remarks = remarksInput.trim();
  return prisma.$transaction(async (tx) => {
    const recommendation = await tx.paymentRecommendation.findUnique({ where: { id: recommendationId }, select: { id: true, reportId: true, status: true, report: { select: { status: true, isComplete: true, processingError: true } }, taskCalculations: { select: { recommendationAmount: true, completionPercentage: true, recommendedAmount: true } } } });
    if (!recommendation) throw new PaymentRecommendationError("NOT_FOUND", "Recommendation was not found.", 404);
    if (recommendation.status !== "DRAFT") throw new PaymentRecommendationError("LOCKED", "Only draft recommendations can be finalized.", 409);
    if (recommendation.report.status !== "ADMIN_APPROVED" || !recommendation.report.isComplete || recommendation.report.processingError || recommendation.taskCalculations.length === 0 || recommendation.taskCalculations.some((task) => task.recommendationAmount.isNegative() || task.completionPercentage.isNegative() || task.completionPercentage.gt(100))) throw new PaymentRecommendationError("INCOMPLETE_REPORT", "The recommendation is incomplete or its report is not Administration-approved.", 409);
    const finalized = await tx.paymentRecommendation.update({ where: { id: recommendationId, status: "DRAFT" }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedByUserId: actor.id, finalizationRemarks: remarks || null }, select: { id: true, status: true, finalizedAt: true } });
    await tx.activityLog.create({ data: { userId: actor.id, action: "PAYMENT_RECOMMENDATION_FINALIZED", entityType: "PaymentRecommendation", entityId: recommendationId, description: "Payment recommendation finalized for final reporting.", metadata: metadata({ reportId: recommendation.reportId, remarks }) } });
    return finalized;
  });
}
