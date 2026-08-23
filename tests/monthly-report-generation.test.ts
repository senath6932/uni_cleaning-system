import { describe, expect, it, vi } from "vitest";
import { buildTaskSummary, generateMonthlyReportsForPeriod, getPreviousReportingPeriod, getReportingPeriodDates } from "@/lib/monthly-report-generation";

const dates = Array.from({ length: 31 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`);
const baseTask = { id: "location-task-1", locationId: "location-1", frequency: "DAILY" as const, allocatedAmount: "20000", createdAt: new Date("2026-07-01T00:00:00Z"), task: { id: "task-1", name: "Floor Cleaning", category: "DAILY" as const, frequency: "DAILY" as const } };
type TaskInput = Parameters<typeof buildTaskSummary>[0];
const task = baseTask as unknown as TaskInput;
function evaluation(date: string, result: string) { return { evaluationDate: new Date(`${date}T00:00:00Z`), result, remark: null, evaluatingOfficer: { id: "officer-1", name: "Officer" }, createdAt: new Date(`${date}T01:00:00Z`), finalizedAt: new Date(`${date}T02:00:00Z`), lockedAt: new Date(`${date}T02:00:00Z`) }; }

describe("monthly report generation rules", () => {
  it("calculates P20 X5 NA1 as 80 percent", () => {
    const result = buildTaskSummary(task, dates, [
      ...Array.from({ length: 20 }, (_, index) => evaluation(`2026-08-${String(index + 1).padStart(2, "0")}`, "P")),
      ...Array.from({ length: 5 }, (_, index) => evaluation(`2026-08-${String(index + 21).padStart(2, "0")}`, "X")),
      evaluation("2026-08-26", "NA"),
    ]);
    expect(result.passedOccurrences).toBe(20);
    expect(result.failedOccurrences).toBe(5);
    expect(result.notApplicableOccurrences).toBe(1);
    expect(result.completionPercentage).toBe("80.00");
  });

  it("returns zero for an NA-only task", () => {
    const result = buildTaskSummary(task, dates, dates.map((date) => evaluation(date, "NA")));
    expect(result.completionPercentage).toBe("0.00");
    expect(result.missingOccurrences).toBe(0);
  });

  it("detects missing expected evaluations instead of treating them as valid", () => {
    const result = buildTaskSummary(task, dates, [evaluation("2026-08-01", "P")]);
    expect(result.missingOccurrences).toBe(30);
    expect(result.completionPercentage).toBe("100.00");
  });

  it("respects weekly and monthly schedules", () => {
    const weekly = { ...task, frequency: "WEEKLY" as const, createdAt: new Date("2026-08-03T00:00:00Z") };
    const monthly = { ...task, frequency: "MONTHLY" as const, createdAt: new Date("2026-08-03T00:00:00Z") };
    expect(buildTaskSummary(weekly, ["2026-08-03", "2026-08-10", "2026-08-11"], [evaluation("2026-08-03", "P"), evaluation("2026-08-10", "X")]).expectedOccurrences).toBe(2);
    expect(buildTaskSummary(monthly, ["2026-08-03", "2026-08-10", "2026-08-31"], [evaluation("2026-08-03", "P")]).expectedOccurrences).toBe(1);
  });

  it("uses the previous business month and calendar-safe period boundaries", () => {
    expect(getPreviousReportingPeriod(new Date("2026-09-01T00:00:00Z"))).toEqual({ month: 8, year: 2026 });
    const leap = getReportingPeriodDates({ month: 2, year: 2028 });
    expect(leap.dates).toHaveLength(29);
    expect(leap.dates.at(-1)).toBe("2028-02-29");
  });

  it("does not duplicate a submitted report or its notifications on retry", async () => {
    const transaction = {
      monthlyEvaluationReport: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "report-1", status: "SUBMITTED" }), create: vi.fn().mockResolvedValue({ id: "report-1" }) },
      monthlyTaskSummary: { deleteMany: vi.fn(), createMany: vi.fn() },
      activityLog: { create: vi.fn() },
      user: { findMany: vi.fn().mockResolvedValue([{ id: "admin-1" }]) },
      notification: { create: vi.fn() },
    };
    const attendance = dates.map((date) => ({ id: `attendance-${date}`, attendanceDate: new Date(`${date}T00:00:00Z`), totalPresentCount: 20, phiUserId: "phi-1", remark: null, createdAt: new Date(`${date}T01:00:00Z`), finalizedAt: new Date(`${date}T02:00:00Z`), lockedAt: new Date(`${date}T02:00:00Z`), phiUser: { id: "phi-1", name: "PHI" } }));
    const evaluations = dates.map((date) => ({ id: `evaluation-${date}`, locationTaskId: "location-task-1", evaluationDate: new Date(`${date}T00:00:00Z`), result: "P" as const, remark: null, createdAt: new Date(`${date}T01:00:00Z`), finalizedAt: new Date(`${date}T02:00:00Z`), lockedAt: new Date(`${date}T02:00:00Z`), evaluatingOfficer: { id: "officer-1", name: "Officer" } }));
    const prisma = { location: { findMany: vi.fn().mockResolvedValue([{ id: "location-1", code: "SCI", name: "Science Block" }]) }, locationTask: { findMany: vi.fn().mockResolvedValue([baseTask]) }, dailyCleaningEvaluation: { findMany: vi.fn().mockResolvedValue(evaluations) }, dailyAttendanceEvaluation: { findMany: vi.fn().mockResolvedValue(attendance) }, $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)) };
    const first = await generateMonthlyReportsForPeriod(prisma as never, { month: 8, year: 2026, actorUserId: "gaa-1", now: new Date("2026-09-01T00:00:00Z") });
    const second = await generateMonthlyReportsForPeriod(prisma as never, { month: 8, year: 2026, actorUserId: "gaa-1", now: new Date("2026-09-01T00:00:00Z") });
    expect(first.reportsCreated).toBe(1);
    expect(first.notificationsCreated).toBe(1);
    expect(second.reportsAlreadyExist).toBe(1);
    expect(transaction.notification.create).toHaveBeenCalledTimes(1);
  });
});
