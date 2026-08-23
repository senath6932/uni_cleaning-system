import type { Prisma, PrismaClient, UserRole } from "@/app/generated/prisma/client";
import { dateStringToUtcDate, getBusinessDateString } from "@/lib/business-date";

const reportLocationSelect = {
  id: true,
  code: true,
  name: true,
} satisfies Prisma.LocationSelect;

const taskSummarySelect = {
  id: true,
  taskNameSnapshot: true,
  categorySnapshot: true,
  frequencySnapshot: true,
  allocatedAmount: true,
  completionPercentage: true,
  expectedOccurrences: true,
  passedOccurrences: true,
  failedOccurrences: true,
  notApplicableOccurrences: true,
  missingOccurrences: true,
  evaluationHistory: true,
  taskRemarks: true,
} satisfies Prisma.MonthlyTaskSummarySelect;

const listSelect = {
  id: true,
  month: true,
  year: true,
  status: true,
  generatedAt: true,
  submittedAt: true,
  location: { select: reportLocationSelect },
} satisfies Prisma.MonthlyEvaluationReportSelect;

const detailSelect = {
  ...listSelect,
  isComplete: true,
  processingError: true,
  attendanceHistory: true,
  createdAt: true,
  taskSummaries: { select: { ...taskSummarySelect, locationTaskId: true } },
} satisfies Prisma.MonthlyEvaluationReportSelect;

type ReportAccess = {
  userId: string;
  role: UserRole;
};

type ReportFilters = {
  query?: string;
  month?: number;
  year?: number;
  locationId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

function accessibleLocationWhere(access: ReportAccess): Prisma.MonthlyEvaluationReportWhereInput {
  if (access.role === "EVALUATING_OFFICER") {
    return { location: { evaluatingOfficerAssignments: { some: { userId: access.userId, active: true } } } };
  }

  if (access.role === "PHI") {
    return { location: { phiAssignments: { some: { userId: access.userId, active: true } } } };
  }

  return {};
}

function buildWhere(access: ReportAccess, filters: ReportFilters): Prisma.MonthlyEvaluationReportWhereInput {
  const search = filters.query?.trim();
  return {
    ...accessibleLocationWhere(access),
    ...(filters.month ? { month: filters.month } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.status ? { status: filters.status as Prisma.MonthlyEvaluationReportWhereInput["status"] } : {}),
    ...(search
      ? {
          location: {
            ...((accessibleLocationWhere(access).location as Prisma.LocationWhereInput) ?? {}),
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
}

export async function listMonthlyReports(
  prisma: Pick<PrismaClient, "monthlyEvaluationReport">,
  access: ReportAccess,
  filters: ReportFilters,
) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(access, filters);
  const [total, reports] = await Promise.all([
    prisma.monthlyEvaluationReport.count({ where }),
    prisma.monthlyEvaluationReport.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { location: { code: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: listSelect,
    }),
  ]);

  return {
    reports,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listMonthlyReportReferenceData(
  prisma: Pick<PrismaClient, "location">,
  access: ReportAccess,
) {
  const where = access.role === "EVALUATING_OFFICER"
    ? { evaluatingOfficerAssignments: { some: { userId: access.userId, active: true } } }
    : access.role === "PHI"
      ? { phiAssignments: { some: { userId: access.userId, active: true } } }
      : {};

  return prisma.location.findMany({
    where,
    select: reportLocationSelect,
    orderBy: [{ code: "asc" }],
  });
}

export async function getMonthlyReport(
  prisma: Pick<PrismaClient, "monthlyEvaluationReport" | "dailyCleaningEvaluation" | "dailyAttendanceEvaluation">,
  access: ReportAccess,
  reportId: string,
) {
  const report = await prisma.monthlyEvaluationReport.findFirst({
    where: { id: reportId, ...accessibleLocationWhere(access) },
    select: detailSelect,
  });

  if (!report) return null;

  const from = dateStringToUtcDate(`${report.year}-${String(report.month).padStart(2, "0")}-01`);
  const nextMonth = report.month === 12 ? `${report.year + 1}-01-01` : `${report.year}-${String(report.month + 1).padStart(2, "0")}-01`;
  const to = dateStringToUtcDate(nextMonth);
  if (!from || !to) {
    return {
      report: {
        ...report,
        taskSummaries: report.taskSummaries.map((summary) => ({
          ...summary,
          applicableOccurrences: summary.passedOccurrences + summary.failedOccurrences,
        })),
      },
      evaluations: [],
      attendance: [],
    };
  }

  const [evaluations, attendance] = await Promise.all([
    prisma.dailyCleaningEvaluation.findMany({
      where: { locationId: report.location.id, evaluationDate: { gte: from, lt: to }, locationTaskId: { in: report.taskSummaries.map((summary) => summary.locationTaskId) } },
      orderBy: [{ evaluationDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, locationTaskId: true, evaluationDate: true, result: true, remark: true, evaluatingOfficer: { select: { name: true } }, locationTask: { select: { task: { select: { name: true } } } } },
    }),
    prisma.dailyAttendanceEvaluation.findMany({
      where: { locationId: report.location.id, attendanceDate: { gte: from, lt: to } },
      orderBy: [{ attendanceDate: "asc" }],
      select: { id: true, attendanceDate: true, totalPresentCount: true, remark: true },
    }),
  ]);

  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
  const asUnknownArray = (value: unknown) => Array.isArray(value) ? value : [];
  const snapshotEvaluations = report.taskSummaries.flatMap((summary) => {
    return asUnknownArray(summary.evaluationHistory).filter(isRecord).map((item, index) => ({
      id: typeof item.id === "string" ? item.id : `${summary.id}-${index}`,
      locationTaskId: summary.locationTaskId,
      evaluationDate: typeof item.date === "string" ? item.date : "",
      result: typeof item.result === "string" ? item.result : "NA",
      remark: typeof item.remark === "string" ? item.remark : null,
      evaluatingOfficer: { name: typeof item.evaluatingOfficerName === "string" ? item.evaluatingOfficerName : "-" },
      locationTask: { task: { name: summary.taskNameSnapshot } },
    }));
  });
  const snapshotAttendance = Array.isArray(report.attendanceHistory)
    ? asUnknownArray(report.attendanceHistory).filter(isRecord).map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `attendance-${index}`,
        attendanceDate: typeof item.date === "string" ? item.date : "",
        totalPresentCount: typeof item.totalPresentCount === "number" ? item.totalPresentCount : 0,
        remark: typeof item.remark === "string" ? item.remark : null,
      }))
    : null;

  return {
    report: {
      ...report,
      taskSummaries: report.taskSummaries.map((summary) => ({
        ...summary,
        applicableOccurrences: summary.passedOccurrences + summary.failedOccurrences,
      })),
    },
    evaluations: snapshotEvaluations.length ? snapshotEvaluations : evaluations.map((evaluation) => ({ ...evaluation, evaluationDate: getBusinessDateString(evaluation.evaluationDate) })),
    attendance: snapshotAttendance ?? attendance.map((entry) => ({ ...entry, attendanceDate: getBusinessDateString(entry.attendanceDate) })),
  };
}
