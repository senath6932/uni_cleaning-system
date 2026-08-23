import { Prisma, type PrismaClient, type UserRole } from "@/app/generated/prisma/client";
import { getBusinessDateString } from "@/lib/business-date";

export const PHI_MONTHLY_ATTENDANCE_CATEGORIES = [
  {
    key: "HALF_DAY_EMPLOYEES",
    label: "Half day employees",
    defaultRate: "800.00",
  },
  {
    key: "HALF_DAY_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR",
    label: "Half day Grass cutters/Gully cleaner/Tractor operator",
    defaultRate: "1370.00",
  },
  {
    key: "HALF_DAY_SUPERVISORS",
    label: "Half day Supervisors",
    defaultRate: "1370.00",
  },
  {
    key: "ABSENT_EMPLOYEES",
    label: "Absent employees",
    defaultRate: "1600.00",
  },
  {
    key: "ABSENT_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR",
    label: "Absent Grass cutters/Gully cleaner/Tractor operator",
    defaultRate: "2740.00",
  },
  {
    key: "ABSENT_SUPERVISORS",
    label: "Absent Supervisors",
    defaultRate: "2740.00",
  },
] as const;

export type PhiMonthlyAttendanceCategory = (typeof PHI_MONTHLY_ATTENDANCE_CATEGORIES)[number]["key"];

export type PhiMonthlyAttendanceRowInput = {
  category: PhiMonthlyAttendanceCategory;
  employeeCount: unknown;
  deductionRate: unknown;
};

export type PhiMonthlyAttendanceInput = {
  month: unknown;
  year: unknown;
  action?: "save" | "submit";
  rows: PhiMonthlyAttendanceRowInput[];
};

export type PhiMonthlyAttendanceAccess = {
  id: string;
  role: UserRole;
  active: boolean;
  name: string;
};

export class PhiMonthlyAttendanceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PhiMonthlyAttendanceError";
    this.code = code;
    this.status = status;
  }
}

const categoryOrder = PHI_MONTHLY_ATTENDANCE_CATEGORIES.map((category) => category.key);
const categoryLabels = new Map(PHI_MONTHLY_ATTENDANCE_CATEGORIES.map((category) => [category.key, category.label] as const));

function assertPhi(actor: PhiMonthlyAttendanceAccess) {
  if (!actor.active || actor.role !== "PHI") {
    throw new PhiMonthlyAttendanceError("ACCESS_DENIED", "Only active PHI users can manage monthly attendance reports.", 403);
  }
}

function parseInteger(value: unknown, name: string) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(parsed)) {
    throw new PhiMonthlyAttendanceError("INVALID_VALUE", `${name} must be an integer.`);
  }
  return parsed;
}

function parseRate(value: unknown, name: string) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PhiMonthlyAttendanceError("INVALID_VALUE", `${name} must be a non-negative number.`);
  }
  return parsed;
}

function normalizeMonthYear(input: PhiMonthlyAttendanceInput) {
  const month = parseInteger(input.month, "Month");
  const year = parseInteger(input.year, "Year");
  if (month < 1 || month > 12 || year < 1970) {
    throw new PhiMonthlyAttendanceError("INVALID_PERIOD", "A valid month and year are required.");
  }
  return { month, year };
}

function getCategoryLabel(category: PhiMonthlyAttendanceCategory) {
  return categoryLabels.get(category) ?? category;
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function periodKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function statusForSave(existingStatus?: string | null, submitted = false) {
  if (!submitted) return "DRAFT" as const;
  return existingStatus === "CORRECTION_REQUESTED" ? "RESUBMITTED" as const : "SUBMITTED" as const;
}

function rowMap(rows: PhiMonthlyAttendanceRowInput[]) {
  const map = new Map<PhiMonthlyAttendanceCategory, PhiMonthlyAttendanceRowInput>();
  for (const row of rows) map.set(row.category, row);
  return map;
}

export function calculatePhiMonthlyAttendanceRows(rows: PhiMonthlyAttendanceRowInput[]) {
  const map = rowMap(rows);
  const summaries = categoryOrder.map((category) => {
    const row = map.get(category);
    if (!row) {
      throw new PhiMonthlyAttendanceError("MISSING_ROW", `Missing category: ${getCategoryLabel(category)}.`);
    }

    const employeeCount = parseInteger(row.employeeCount, `${getCategoryLabel(category)} employee count`);
    if (employeeCount < 0) {
      throw new PhiMonthlyAttendanceError("INVALID_EMPLOYEE_COUNT", "Employee count cannot be negative.");
    }

    const deductionRate = parseRate(row.deductionRate, `${getCategoryLabel(category)} deduction rate`);
    const rowTotal = toDecimal(employeeCount * deductionRate);

    return {
      category,
      employeeCount,
      deductionRate: toDecimal(deductionRate),
      rowTotal,
    };
  });

  const grandTotal = summaries.reduce((sum, item) => sum.add(item.rowTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
  return { summaries, grandTotal };
}

type ReportSelect = {
  id: true;
  phiUserId: true;
  month: true;
  year: true;
  status: true;
  processingError: true;
  grandTotal: true;
  generatedAt: true;
  submittedAt: true;
  resubmittedAt: true;
  finalizedAt: true;
  createdAt: true;
  updatedAt: true;
  phiUser: { select: { id: true; name: true; email: true; role: true; active: true } };
  rows: { orderBy: { category: "asc" }; select: { id: true; category: true; employeeCount: true; deductionRate: true; rowTotal: true } };
  reviews: { orderBy: { createdAt: "desc" }; select: { id: true; decision: true; remarks: true; reviewedAt: true; reviewer: { select: { name: true } } } };
};

const detailSelect = {
  id: true,
  phiUserId: true,
  month: true,
  year: true,
  status: true,
  processingError: true,
  grandTotal: true,
  generatedAt: true,
  submittedAt: true,
  resubmittedAt: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  phiUser: { select: { id: true, name: true, email: true, role: true, active: true } },
  rows: { orderBy: { category: "asc" }, select: { id: true, category: true, employeeCount: true, deductionRate: true, rowTotal: true } },
  reviews: { orderBy: { createdAt: "desc" }, select: { id: true, decision: true, remarks: true, reviewedAt: true, reviewer: { select: { name: true } } } },
} satisfies ReportSelect;

function assertCanView(report: { phiUserId: string }, actor: { id: string; role: UserRole }) {
  if (actor.role === "PHI" && report.phiUserId !== actor.id) {
    throw new PhiMonthlyAttendanceError("ACCESS_DENIED", "You do not have permission to view this report.", 403);
  }
}

async function resolveReport(prisma: Pick<PrismaClient, "phiMonthlyAttendanceReport">, phiUserId: string, month: number, year: number) {
  return prisma.phiMonthlyAttendanceReport.findUnique({
    where: { phiUserId_month_year: { phiUserId, month, year } },
    select: detailSelect,
  });
}

export async function getPhiMonthlyAttendanceReport(
  prisma: Pick<PrismaClient, "phiMonthlyAttendanceReport">,
  actor: { id: string; role: UserRole },
  reportId: string,
) {
  const report = await prisma.phiMonthlyAttendanceReport.findUnique({
    where: { id: reportId },
    select: detailSelect,
  });

  if (!report) return null;
  assertCanView(report, actor);
  return report;
}

export async function getPhiMonthlyAttendanceReportForPeriod(
  prisma: Pick<PrismaClient, "phiMonthlyAttendanceReport">,
  actor: { id: string; role: UserRole },
  month: number,
  year: number,
) {
  const report = await resolveReport(prisma, actor.id, month, year);
  if (!report) return null;
  assertCanView(report, actor);
  return report;
}

export async function listPhiMonthlyAttendanceReports(
  prisma: Pick<PrismaClient, "phiMonthlyAttendanceReport">,
  actor: { id: string; role: UserRole },
  filters: { month?: number; year?: number; page?: number; pageSize?: number } = {},
) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const where = actor.role === "PHI" ? { phiUserId: actor.id } : {};
  const [total, reports] = await Promise.all([
    prisma.phiMonthlyAttendanceReport.count({ where: { ...where, ...(filters.month ? { month: filters.month } : {}), ...(filters.year ? { year: filters.year } : {}) } }),
    prisma.phiMonthlyAttendanceReport.findMany({
      where: { ...where, ...(filters.month ? { month: filters.month } : {}), ...(filters.year ? { year: filters.year } : {}) },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: detailSelect,
    }),
  ]);

  return { reports, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function savePhiMonthlyAttendanceReport(
  prisma: Pick<PrismaClient, "$transaction" | "phiMonthlyAttendanceReport" | "user" | "activityLog" | "notification">,
  actor: PhiMonthlyAttendanceAccess,
  input: PhiMonthlyAttendanceInput,
) {
  assertPhi(actor);
  const { month, year } = normalizeMonthYear(input);
  const submitted = (input.action ?? "save") === "submit";
  const { summaries, grandTotal } = calculatePhiMonthlyAttendanceRows(input.rows);

  const report = await prisma.$transaction(async (tx) => {
    const existing = await tx.phiMonthlyAttendanceReport.findUnique({
      where: { phiUserId_month_year: { phiUserId: actor.id, month, year } },
      select: { id: true, status: true, generatedAt: true },
    });

    if (existing?.status === "ADMIN_APPROVED" || existing?.status === "ADMIN_REJECTED") {
      throw new PhiMonthlyAttendanceError("REPORT_LOCKED", "This report has already been finalized.", 409);
    }

    const now = new Date();
    const status = statusForSave(existing?.status, submitted);
    const saved = existing
      ? await tx.phiMonthlyAttendanceReport.update({
          where: { id: existing.id },
          data: {
            status,
            processingError: null,
            grandTotal,
            generatedAt: existing.generatedAt ?? now,
            submittedAt: submitted && status === "SUBMITTED" ? now : undefined,
            resubmittedAt: submitted && status === "RESUBMITTED" ? now : undefined,
          },
          select: { id: true },
        })
      : await tx.phiMonthlyAttendanceReport.create({
          data: {
            phiUserId: actor.id,
            month,
            year,
            status,
            processingError: null,
            grandTotal,
            generatedAt: now,
            submittedAt: submitted ? now : null,
            resubmittedAt: null,
          },
          select: { id: true },
        });

    await tx.phiMonthlyAttendanceSummary.deleteMany({ where: { reportId: saved.id } });
    await tx.phiMonthlyAttendanceSummary.createMany({
      data: summaries.map((row) => ({
        reportId: saved.id,
        category: row.category,
        employeeCount: row.employeeCount,
        deductionRate: row.deductionRate,
        rowTotal: row.rowTotal,
      })),
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: submitted ? (status === "RESUBMITTED" ? "REPORT_RESUBMITTED" : "REPORT_SUBMITTED") : "MONTHLY_REPORT_GENERATED",
        entityType: "PhiMonthlyAttendanceReport",
        entityId: saved.id,
        description: submitted ? "PHI monthly attendance report submitted." : "PHI monthly attendance report saved as draft.",
        metadata: {
          month,
          year,
          status,
          grandTotal: grandTotal.toString(),
          period: periodKey(month, year),
        } as Prisma.InputJsonValue,
      },
    });

    if (submitted) {
      const admins = await tx.user.findMany({ where: { active: true, role: "ADMINISTRATION_OFFICER" }, select: { id: true } });
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            recipientUserId: admin.id,
            event: "MONTHLY_REPORT_AUTOMATICALLY_SUBMITTED",
            title: "PHI Monthly Attendance Submitted",
            message: `PHI monthly attendance report for ${getBusinessDateString(new Date(Date.UTC(year, month - 1, 1)))} has been submitted.`,
            entityType: "PhiMonthlyAttendanceReport",
            entityId: saved.id,
            dedupeKey: `phi-monthly-attendance-submitted:${saved.id}:${admin.id}`,
            metadata: { reportId: saved.id, month, year, status } as Prisma.InputJsonValue,
          },
        });
      }
    }

    return saved;
  }).catch((error) => {
    if (isUniqueConstraintError(error)) {
      throw new PhiMonthlyAttendanceError("DUPLICATE_REPORT", "A report already exists for this month.", 409);
    }
    throw error;
  });

  return getPhiMonthlyAttendanceReport(prisma, actor, report.id);
}

export async function decidePhiMonthlyAttendanceReport(
  prisma: Pick<PrismaClient, "$transaction" | "phiMonthlyAttendanceReport" | "phiMonthlyAttendanceReview" | "user" | "activityLog" | "notification">,
  actor: { id: string; name: string; role: UserRole; active: boolean },
  reportId: string,
  decision: "APPROVE" | "CORRECTION" | "REJECT",
  remarksInput?: string,
) {
  if (!actor.active || actor.role !== "ADMINISTRATION_OFFICER") {
    throw new PhiMonthlyAttendanceError("ACCESS_DENIED", "You do not have permission to review this report.", 403);
  }

  const remarks = remarksInput?.trim() ?? "";
  if (decision !== "APPROVE" && !remarks) {
    throw new PhiMonthlyAttendanceError("REMARKS_REQUIRED", decision === "CORRECTION" ? "Correction remarks are required." : "Rejection remarks are required.");
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.phiMonthlyAttendanceReport.findUnique({
      where: { id: reportId },
      select: { id: true, phiUserId: true, month: true, year: true, status: true, phiUser: { select: { name: true } } },
    });

    if (!current || !["SUBMITTED", "RESUBMITTED"].includes(current.status)) {
      throw new PhiMonthlyAttendanceError("REPORT_NOT_REVIEWABLE", "This report is not available for review.", 409);
    }

    const nextStatus = decision === "APPROVE" ? "ADMIN_APPROVED" : decision === "CORRECTION" ? "CORRECTION_REQUESTED" : "ADMIN_REJECTED";
    const changed = await tx.phiMonthlyAttendanceReport.updateMany({
      where: { id: reportId, status: { in: ["SUBMITTED", "RESUBMITTED"] } },
      data: {
        status: nextStatus,
        finalizedAt: decision === "APPROVE" ? new Date() : undefined,
      },
    });

    if (changed.count !== 1) {
      throw new PhiMonthlyAttendanceError("ALREADY_REVIEWED", "This report has already been reviewed.", 409);
    }

    const review = await tx.phiMonthlyAttendanceReview.create({
      data: {
        reportId,
        reviewerId: actor.id,
        decision,
        remarks: remarks || null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: decision === "APPROVE" ? "ADMIN_APPROVED" : decision === "CORRECTION" ? "CORRECTION_REQUESTED" : "ADMIN_REJECTED",
        entityType: "PhiMonthlyAttendanceReport",
        entityId: reportId,
        description: `PHI monthly attendance report ${decision === "APPROVE" ? "approved" : decision === "CORRECTION" ? "sent for correction" : "rejected"}.`,
        metadata: {
          reportId,
          reviewerId: actor.id,
          decision,
          remarks,
          previousStatus: current.status,
          newStatus: nextStatus,
          month: current.month,
          year: current.year,
        } as Prisma.InputJsonValue,
      },
    });

    const recipients = decision === "APPROVE"
      ? await tx.user.findMany({ where: { active: true, role: { in: ["GAA", "PHI"] } }, select: { id: true } })
      : await tx.user.findMany({
          where: {
            active: true,
            OR: [
              { id: current.phiUserId },
              { role: "ADMINISTRATION_OFFICER" },
            ],
          },
          select: { id: true },
        });

    for (const recipient of recipients) {
      await tx.notification.create({
        data: {
          recipientUserId: recipient.id,
          event: decision === "APPROVE" ? "ADMINISTRATION_APPROVED" : decision === "CORRECTION" ? "CORRECTION_REQUESTED" : "ADMINISTRATION_REJECTED",
          title: decision === "APPROVE" ? "Monthly Attendance Approved" : decision === "CORRECTION" ? "Monthly Attendance Correction Requested" : "Monthly Attendance Rejected",
          message: `PHI monthly attendance report for ${current.phiUser.name} (${current.month}/${current.year}) has been ${decision === "APPROVE" ? "approved" : decision === "CORRECTION" ? "sent back for correction" : "rejected"}.${remarks ? ` Remarks: ${remarks}` : ""}`,
          entityType: "PhiMonthlyAttendanceReport",
          entityId: reportId,
          dedupeKey: `phi-monthly-attendance-review:${review.id}:${recipient.id}`,
          metadata: { reportId, decision, reviewId: review.id } as Prisma.InputJsonValue,
        },
      });
    }

    return { status: nextStatus, review };
  });
}
