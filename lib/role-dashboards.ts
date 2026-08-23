import type { PrismaClient } from "@/app/generated/prisma/client";
import { getBusinessDateString, dateStringToUtcDate } from "@/lib/business-date";
import { listOfficerMonitoringLocations } from "@/lib/evaluating-officer-monitoring";
import { listPhiAuthorizedLocations } from "@/lib/phi-attendance-monitoring";

export async function getGAADashboardData(prisma: Pick<PrismaClient, "location" | "cleaningTask" | "monthlyEvaluationReport" | "activityLog">) {
  const [locations, activeTasks, monthlyReports, approvedReports, activity] = await Promise.all([
    prisma.location.count({ where: { active: true } }),
    prisma.cleaningTask.count({ where: { active: true } }),
    prisma.monthlyEvaluationReport.count(),
    prisma.monthlyEvaluationReport.count({ where: { status: "ADMIN_APPROVED" } }),
    prisma.activityLog.findMany({ take: 8, orderBy: { timestamp: "desc" }, select: { id: true, action: true, description: true, timestamp: true, user: { select: { name: true } } } }),
  ]);
  return { locations, activeTasks, monthlyReports, approvedReports, activity };
}

export async function getAdministrationDashboardData(prisma: Pick<PrismaClient, "monthlyEvaluationReport" | "administrationReview">) {
  const [pending, submitted, resubmitted, approved, rejected, recentReviews] = await Promise.all([
    prisma.monthlyEvaluationReport.count({ where: { status: { in: ["SUBMITTED", "RESUBMITTED"] } } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "SUBMITTED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "RESUBMITTED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "ADMIN_APPROVED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "ADMIN_REJECTED" } }),
    prisma.administrationReview.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id: true, decision: true, remarks: true, createdAt: true, reviewer: { select: { name: true } }, report: { select: { month: true, year: true, location: { select: { name: true, code: true } } } } } }),
  ]);
  return { pending, submitted, resubmitted, approved, rejected, recentReviews };
}

export async function getEvaluatingOfficerDashboardData(prisma: Pick<PrismaClient, "evaluatingOfficerAssignment" | "locationTask" | "dailyCleaningEvaluation" | "monthlyEvaluationReport">, userId: string) {
  const today = getBusinessDateString();
  const assignedLocations = await listOfficerMonitoringLocations(prisma, userId, today);
  const locationIds = assignedLocations.map((location) => location.id);
  const [currentMonthReports, correctionRequests] = await Promise.all([
    prisma.monthlyEvaluationReport.count({ where: { locationId: { in: locationIds }, month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) } }),
    prisma.monthlyEvaluationReport.count({ where: { locationId: { in: locationIds }, status: "CORRECTION_REQUESTED" } }),
  ]);
  return { assignedLocations, evaluatedToday: assignedLocations.reduce((total, location) => total + location.evaluatedTaskCount, 0), pendingEvaluations: assignedLocations.reduce((total, location) => total + Math.max(location.activeTaskCount - location.evaluatedTaskCount, 0), 0), currentMonthReports, correctionRequests };
}

export async function getPHIDashboardData(prisma: Pick<PrismaClient, "pHIAssignment" | "workerLocationAssignment" | "dailyAttendanceEvaluation">, userId: string) {
  const today = getBusinessDateString();
  const todayDate = dateStringToUtcDate(today) ?? new Date();
  const monthStart = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1));
  const authorizedLocations = await listPhiAuthorizedLocations(prisma, userId);
  const locationIds = authorizedLocations.map((location) => location.id);
  const [todayEntries, todayTotal, currentMonthEntries] = await Promise.all([
    prisma.dailyAttendanceEvaluation.count({ where: { phiUserId: userId, attendanceDate: todayDate } }),
    prisma.dailyAttendanceEvaluation.aggregate({ where: { phiUserId: userId, attendanceDate: todayDate }, _sum: { totalPresentCount: true } }),
    prisma.dailyAttendanceEvaluation.count({ where: { phiUserId: userId, locationId: { in: locationIds }, attendanceDate: { gte: monthStart, lt: new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1, 1)) } } }),
  ]);
  return { authorizedLocations, today, todayEntries, todayTotal: todayTotal._sum.totalPresentCount ?? 0, currentMonthEntries };
}

export async function getViceChancellorDashboardData(prisma: Pick<PrismaClient, "monthlyEvaluationReport">) {
  const [pending, approved, rejected, clarification] = await Promise.all([
    prisma.monthlyEvaluationReport.count({ where: { status: "VC_PENDING" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "VC_APPROVED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "VC_REJECTED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "CLARIFICATION_REQUESTED" } }),
  ]);
  return { pending, approved, rejected, clarification };
}
