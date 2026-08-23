import type { Prisma, PrismaClient, TaskFrequency } from "@/app/generated/prisma/client";
import { dateStringToUtcDate, getBusinessDateString, getBusinessTimeZone } from "@/lib/business-date";

export type ReportingPeriod = { month: number; year: number };
export type MonthlyGenerationOptions = ReportingPeriod & { actorUserId?: string; now?: Date };

type PeriodDates = { start: Date; endExclusive: Date; dates: string[]; label: string };

export class MonthlyReportGenerationError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "MonthlyReportGenerationError";
    this.code = code;
    this.status = status;
  }
}

const locationSelect = { id: true, code: true, name: true } satisfies Prisma.LocationSelect;
const locationTaskSelect = {
  id: true,
  locationId: true,
  frequency: true,
  allocatedAmount: true,
  createdAt: true,
  task: { select: { id: true, name: true, category: true, frequency: true } },
} satisfies Prisma.LocationTaskSelect;

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function periodKey(period: ReportingPeriod) { return `${period.year}-${String(period.month).padStart(2, "0")}`; }

export function getPreviousReportingPeriod(now = new Date()): ReportingPeriod {
  const current = getBusinessDateString(now).slice(0, 7).split("-").map(Number);
  const year = current[0] ?? 1970;
  const month = current[1] ?? 1;
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function getReportingPeriodDates(period: ReportingPeriod): PeriodDates {
  if (!Number.isInteger(period.year) || period.year < 1970 || !Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new MonthlyReportGenerationError("INVALID_PERIOD", "A valid reporting month and year are required.");
  }
  const start = dateStringToUtcDate(`${period.year}-${String(period.month).padStart(2, "0")}-01`);
  const endExclusive = dateStringToUtcDate(period.month === 12 ? `${period.year + 1}-01-01` : `${period.year}-${String(period.month + 1).padStart(2, "0")}-01`);
  if (!start || !endExclusive) throw new MonthlyReportGenerationError("INVALID_PERIOD", "The reporting period is invalid.");
  const dates: string[] = [];
  for (let date = new Date(start); date < endExclusive; date.setUTCDate(date.getUTCDate() + 1)) dates.push(getBusinessDateString(date));
  return { start, endExclusive, dates, label: periodKey(period) };
}

function isExpectedTaskDate(task: { frequency: TaskFrequency; createdAt: Date }, date: string) {
  const taskStart = getBusinessDateString(task.createdAt);
  if (date < taskStart) return false;
  const target = dateStringToUtcDate(date);
  const created = task.createdAt;
  if (!target) return false;
  if (task.frequency === "DAILY") return true;
  if (task.frequency === "WEEKLY") {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: getBusinessTimeZone(), weekday: "short" });
    return formatter.format(target) === formatter.format(created);
  }
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: getBusinessTimeZone(), day: "2-digit" });
  return formatter.format(target) === formatter.format(created);
}

function iso(value: Date | null) { return value?.toISOString() ?? null; }

function percentage(passed: number, failed: number) {
  const applicable = passed + failed;
  if (applicable === 0) return "0.00";
  return ((passed * 100) / applicable).toFixed(2);
}

export function buildTaskSummary(task: Prisma.LocationTaskGetPayload<{ select: typeof locationTaskSelect }>, dates: string[], evaluations: Array<{ evaluationDate: Date; result: string; remark: string | null; evaluatingOfficer: { id: string; name: string }; createdAt: Date; finalizedAt: Date | null; lockedAt: Date | null }>) {
  const expectedDates = dates.filter((date) => isExpectedTaskDate(task, date));
  const byDate = new Map<string, (typeof evaluations)[number]>();
  for (const evaluation of evaluations) byDate.set(getBusinessDateString(evaluation.evaluationDate), evaluation);
  const expectedEvaluations = expectedDates.map((date) => byDate.get(date)).filter(Boolean) as (typeof evaluations)[number][];
  const passed = expectedEvaluations.filter((item) => item.result === "P").length;
  const failed = expectedEvaluations.filter((item) => item.result === "X").length;
  const notApplicable = expectedEvaluations.filter((item) => item.result === "NA").length;
  const missing = expectedDates.filter((date) => !byDate.has(date)).length;
  const history = evaluations.map((item) => ({ id: item.evaluatingOfficer.id, date: getBusinessDateString(item.evaluationDate), result: item.result, remark: item.remark, evaluatingOfficerId: item.evaluatingOfficer.id, evaluatingOfficerName: item.evaluatingOfficer.name, createdAt: item.createdAt.toISOString(), finalizedAt: iso(item.finalizedAt), lockedAt: iso(item.lockedAt) }));
  const remarks = history.filter((item) => item.remark).map((item) => ({ date: item.date, remark: item.remark }));
  return { expectedOccurrences: expectedDates.length, passedOccurrences: passed, failedOccurrences: failed, notApplicableOccurrences: notApplicable, missingOccurrences: missing, completionPercentage: percentage(passed, failed), evaluationHistory: history as unknown as Prisma.InputJsonValue, taskRemarks: remarks as unknown as Prisma.InputJsonValue };
}

async function resolveActorUserId(prisma: Pick<PrismaClient, "user">, actorUserId?: string) {
  if (actorUserId) return actorUserId;
  if (process.env.MONTHLY_REPORT_SYSTEM_ACTOR_ID) return process.env.MONTHLY_REPORT_SYSTEM_ACTOR_ID;
  throw new MonthlyReportGenerationError("SYSTEM_ACTOR_REQUIRED", "Monthly processing requires a configured system actor.", 500);
}

async function processLocation(prisma: PrismaClient, period: ReportingPeriod, dates: PeriodDates, location: { id: string; code: string; name: string }, actorUserId: string) {
  const tasks = await prisma.locationTask.findMany({ where: { locationId: location.id, active: true }, select: locationTaskSelect, orderBy: [{ createdAt: "asc" }] });
  const taskIds = tasks.map((task) => task.id);
  const [evaluations, attendance] = await Promise.all([
    taskIds.length === 0 ? [] : prisma.dailyCleaningEvaluation.findMany({ where: { locationId: location.id, locationTaskId: { in: taskIds }, evaluationDate: { gte: dates.start, lt: dates.endExclusive } }, orderBy: [{ evaluationDate: "asc" }, { createdAt: "asc" }], select: { id: true, locationTaskId: true, evaluationDate: true, result: true, remark: true, createdAt: true, finalizedAt: true, lockedAt: true, evaluatingOfficer: { select: { id: true, name: true } } } }),
    prisma.dailyAttendanceEvaluation.findMany({ where: { locationId: location.id, attendanceDate: { gte: dates.start, lt: dates.endExclusive } }, orderBy: [{ attendanceDate: "asc" }], select: { id: true, attendanceDate: true, totalPresentCount: true, phiUserId: true, remark: true, createdAt: true, finalizedAt: true, lockedAt: true, phiUser: { select: { id: true, name: true } } } }),
  ]);
  const evaluationsByTask = new Map<string, typeof evaluations>();
  for (const evaluation of evaluations) evaluationsByTask.set(evaluation.locationTaskId, [...(evaluationsByTask.get(evaluation.locationTaskId) ?? []), evaluation]);
  const summaries = tasks.map((task) => ({ task, summary: buildTaskSummary(task, dates.dates, evaluationsByTask.get(task.id) ?? []) }));
  const missingEvaluations = summaries.filter((item) => item.summary.missingOccurrences > 0).map((item) => `${item.task.task.name}: ${item.summary.missingOccurrences} missing evaluation(s)`);
  const attendanceHistory = attendance.map((item) => ({ id: item.id, date: getBusinessDateString(item.attendanceDate), locationId: location.id, totalPresentCount: item.totalPresentCount, phiUserId: item.phiUser.id, phiUserName: item.phiUser.name, remark: item.remark, createdAt: item.createdAt.toISOString(), finalizedAt: iso(item.finalizedAt), lockedAt: iso(item.lockedAt) }));
  const missingAttendance = dates.dates.filter((date) => !attendanceHistory.some((item) => item.date === date));
  const errors = [...missingEvaluations, ...(missingAttendance.length ? [`${missingAttendance.length} missing PHI total-present record(s)`] : [])];
  const complete = errors.length === 0;
  const processingError = complete ? null : errors.join("; ");
  let notificationsCreated = 0;
  let reportCreated = false;
  let reportId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.monthlyEvaluationReport.findUnique({ where: { locationId_month_year: { locationId: location.id, month: period.month, year: period.year } }, select: { id: true, status: true } });
      if (existing && existing.status !== "DRAFT") { reportId = existing.id; return; }
      const report = existing
        ? await tx.monthlyEvaluationReport.update({ where: { id: existing.id }, data: { status: complete ? "SUBMITTED" : "DRAFT", isComplete: complete, processingError, generatedAt: complete ? new Date() : null, submittedAt: complete ? new Date() : null, attendanceHistory: attendanceHistory as unknown as Prisma.InputJsonValue }, select: { id: true } })
        : await tx.monthlyEvaluationReport.create({ data: { locationId: location.id, month: period.month, year: period.year, status: complete ? "SUBMITTED" : "DRAFT", isComplete: complete, processingError, generatedAt: complete ? new Date() : null, submittedAt: complete ? new Date() : null, attendanceHistory: attendanceHistory as unknown as Prisma.InputJsonValue }, select: { id: true } });
      reportId = report.id;
      // A previously incomplete draft becomes a newly submitted report on completion.
      reportCreated = !existing || (existing.status === "DRAFT" && complete);
      await tx.monthlyTaskSummary.deleteMany({ where: { reportId: report.id } });
      if (summaries.length) await tx.monthlyTaskSummary.createMany({ data: summaries.map(({ task, summary }) => ({ reportId: report.id, locationTaskId: task.id, taskNameSnapshot: task.task.name, categorySnapshot: task.task.category, frequencySnapshot: task.frequency, allocatedAmount: task.allocatedAmount, recommendedAmount: null, completionPercentage: summary.completionPercentage, expectedOccurrences: summary.expectedOccurrences, passedOccurrences: summary.passedOccurrences, failedOccurrences: summary.failedOccurrences, notApplicableOccurrences: summary.notApplicableOccurrences, missingOccurrences: summary.missingOccurrences, evaluationHistory: summary.evaluationHistory, taskRemarks: summary.taskRemarks })) });
      await tx.activityLog.create({ data: { userId: actorUserId, action: "MONTHLY_REPORT_GENERATED", entityType: "MonthlyEvaluationReport", entityId: report.id, description: complete ? "Monthly evaluation report generated." : "Incomplete monthly evaluation report recorded.", metadata: { month: period.month, year: period.year, locationId: location.id, status: complete ? "SUBMITTED" : "DRAFT", isComplete: complete } as Prisma.InputJsonValue } });
      if (!complete) return;
      await tx.activityLog.create({ data: { userId: actorUserId, action: "REPORT_SUBMITTED", entityType: "MonthlyEvaluationReport", entityId: report.id, description: "Monthly evaluation report submitted automatically.", metadata: { month: period.month, year: period.year, locationId: location.id, status: "SUBMITTED" } as Prisma.InputJsonValue } });
      const administrators = await tx.user.findMany({ where: { role: "ADMINISTRATION_OFFICER", active: true }, select: { id: true } });
      for (const administrator of administrators) {
        await tx.notification.create({ data: { recipientUserId: administrator.id, event: "MONTHLY_REPORT_AUTOMATICALLY_SUBMITTED", title: "Monthly Report Submitted", message: `${location.name} - ${dates.label} monthly report has been generated and submitted for Administration review.`, entityType: "MonthlyEvaluationReport", entityId: report.id, dedupeKey: `monthly-report-submitted:${report.id}:${administrator.id}`, metadata: { reportId: report.id, locationId: location.id, month: period.month, year: period.year, status: "SUBMITTED" } as Prisma.InputJsonValue } });
        notificationsCreated += 1;
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return { status: "already_exists" as const, reportId, notificationsCreated: 0, errors: [] as string[] };
    throw error;
  }
  if (!reportCreated && reportId) return { status: complete ? "already_exists" as const : "incomplete" as const, reportId, notificationsCreated, errors };
  return { status: complete ? "created" as const : "incomplete" as const, reportId, notificationsCreated, errors };
}

export async function generateMonthlyReportsForPeriod(
  prisma: PrismaClient,
  options: MonthlyGenerationOptions,
) {
  const now = options.now ?? new Date();
  const period = { month: options.month, year: options.year };
  const currentPeriod = getBusinessDateString(now).slice(0, 7);
  if (periodKey(period) >= currentPeriod) throw new MonthlyReportGenerationError("OPEN_PERIOD", "The current or a future month cannot be processed.");
  const dates = getReportingPeriodDates(period);
  const actorUserId = await resolveActorUserId(prisma, options.actorUserId);
  const locations = await prisma.location.findMany({ where: { active: true }, select: locationSelect, orderBy: [{ code: "asc" }] });
  const result = { period: dates.label, locationsProcessed: locations.length, reportsCreated: 0, reportsAlreadyExist: 0, reportsIncomplete: 0, notificationsCreated: 0, errors: [] as Array<{ locationId: string; location: string; message: string }> };
  for (const location of locations) {
    try {
      const processed = await processLocation(prisma, period, dates, location, actorUserId);
      result.notificationsCreated += processed.notificationsCreated;
      if (processed.status === "created") result.reportsCreated += 1;
      else if (processed.status === "already_exists") result.reportsAlreadyExist += 1;
      else result.reportsIncomplete += 1;
      if (processed.errors.length) result.errors.push({ locationId: location.id, location: location.name, message: processed.errors.join("; ") });
    } catch (error) {
      result.errors.push({ locationId: location.id, location: location.name, message: error instanceof Error ? "Unable to process this location." : "Unable to process this location." });
    }
  }
  return result;
}

export function getDefaultMonthlyGenerationOptions(now = new Date()): ReportingPeriod { return getPreviousReportingPeriod(now); }
