import type { Prisma, PrismaClient, UserRole } from "@/app/generated/prisma/client";

const reviewableStatuses = ["SUBMITTED", "RESUBMITTED"] as const;
const reportStatuses = ["DRAFT", "SUBMITTED", "RESUBMITTED", "CORRECTION_REQUESTED", "ADMIN_APPROVED", "ADMIN_REJECTED"] as const;
type ReviewableStatus = (typeof reviewableStatuses)[number];
export type AdministrationDecision = "APPROVE" | "CORRECTION" | "REJECT";

export class AdministrationReviewError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AdministrationReviewError";
    this.code = code;
    this.status = status;
  }
}

type Access = { id: string; name: string; role: UserRole; active: boolean };
type ReviewFilters = { query?: string; month?: number; year?: number; locationId?: string; status?: string; page?: number; pageSize?: number };

const locationSelect = { id: true, code: true, name: true } satisfies Prisma.LocationSelect;
const listSelect = {
  id: true, month: true, year: true, status: true, generatedAt: true, submittedAt: true,
  location: { select: locationSelect },
  administrationReviews: {
    orderBy: { createdAt: "desc" }, take: 1,
    select: { id: true, decision: true, remarks: true, createdAt: true, reviewedAt: true, reviewer: { select: { name: true } } },
  },
} satisfies Prisma.MonthlyEvaluationReportSelect;

function assertAdmin(actor: Access) {
  if (!actor.active || actor.role !== "ADMINISTRATION_OFFICER") {
    throw new AdministrationReviewError("ACCESS_DENIED", "You do not have permission to perform this action.", 403);
  }
}

function buildWhere(filters: ReviewFilters): Prisma.MonthlyEvaluationReportWhereInput {
  const query = filters.query?.trim();
  return {
    status: filters.status && reportStatuses.includes(filters.status as (typeof reportStatuses)[number]) ? filters.status as (typeof reportStatuses)[number] : { in: [...reportStatuses] },
    ...(filters.month ? { month: filters.month } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(query ? { location: { OR: [{ code: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] } } : {}),
  };
}

export async function listAdministrationReports(
  prisma: Pick<PrismaClient, "monthlyEvaluationReport">,
  actor: Access,
  filters: ReviewFilters,
) {
  assertAdmin(actor);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(filters);
  const [total, reports] = await Promise.all([
    prisma.monthlyEvaluationReport.count({ where }),
    prisma.monthlyEvaluationReport.findMany({ where, orderBy: [{ year: "desc" }, { month: "desc" }], skip: (page - 1) * pageSize, take: pageSize, select: listSelect }),
  ]);
  return { reports, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdministrationReferenceLocations(
  prisma: Pick<PrismaClient, "location">,
  actor: Access,
) {
  assertAdmin(actor);
  return prisma.location.findMany({ select: locationSelect, orderBy: [{ code: "asc" }] });
}

export async function getAdministrationSummary(
  prisma: Pick<PrismaClient, "monthlyEvaluationReport">,
  actor: Access,
) {
  assertAdmin(actor);
  const [pending, submitted, correction, rejected, approved] = await Promise.all([
    prisma.monthlyEvaluationReport.count({ where: { status: { in: [...reviewableStatuses] } } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "SUBMITTED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "CORRECTION_REQUESTED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "ADMIN_REJECTED" } }),
    prisma.monthlyEvaluationReport.count({ where: { status: "ADMIN_APPROVED" } }),
  ]);
  return { pending, submitted, correction, rejected, approved };
}

export async function getAdministrationReviewHistory(
  prisma: Pick<PrismaClient, "administrationReview">,
  actor: Access,
  reportId: string,
) {
  assertAdmin(actor);
  return prisma.administrationReview.findMany({ where: { reportId }, orderBy: [{ createdAt: "desc" }], select: { id: true, decision: true, remarks: true, reviewedAt: true, createdAt: true, reviewer: { select: { name: true } } } });
}

function decisionDetails(decision: AdministrationDecision) {
  if (decision === "APPROVE") return { review: "APPROVE" as const, status: "ADMIN_APPROVED" as const, action: "ADMIN_APPROVED" as const, event: "ADMINISTRATION_APPROVED" as const, title: "Monthly Report Approved" };
  if (decision === "CORRECTION") return { review: "CORRECTION" as const, status: "CORRECTION_REQUESTED" as const, action: "CORRECTION_REQUESTED" as const, event: "CORRECTION_REQUESTED" as const, title: "Monthly Report Correction Requested" };
  return { review: "REJECT" as const, status: "ADMIN_REJECTED" as const, action: "ADMIN_REJECTED" as const, event: "ADMINISTRATION_REJECTED" as const, title: "Monthly Report Rejected" };
}

export async function decideMonthlyReport(
  prisma: Pick<PrismaClient, "monthlyEvaluationReport" | "$transaction">,
  actor: Access,
  reportId: string,
  decision: AdministrationDecision,
  remarksInput?: string,
) {
  assertAdmin(actor);
  const remarks = remarksInput?.trim() ?? "";
  if (decision !== "APPROVE" && !remarks) {
    throw new AdministrationReviewError(decision === "CORRECTION" ? "REMARKS_REQUIRED" : "REJECTION_REMARKS_REQUIRED", decision === "CORRECTION" ? "Correction remarks are required." : "Rejection remarks are required.");
  }
  const details = decisionDetails(decision);

  return prisma.$transaction(async (tx) => {
    const current = await tx.monthlyEvaluationReport.findUnique({ where: { id: reportId }, select: { id: true, locationId: true, month: true, year: true, status: true, location: { select: locationSelect } } });
    if (!current || !reviewableStatuses.includes(current.status as ReviewableStatus)) {
      throw new AdministrationReviewError("REPORT_NOT_REVIEWABLE", "This report is not available for Administration review.", 409);
    }

    const changed = await tx.monthlyEvaluationReport.updateMany({ where: { id: reportId, status: { in: [...reviewableStatuses] } }, data: { status: details.status } });
    if (changed.count !== 1) throw new AdministrationReviewError("ALREADY_REVIEWED", "This report has already been reviewed.", 409);

    const review = await tx.administrationReview.create({ data: { reportId, reviewerId: actor.id, decision: details.review, remarks: remarks || null } });
    await tx.activityLog.create({ data: { userId: actor.id, action: details.action, entityType: "EvaluationReport", entityId: reportId, description: details.title + ".", metadata: { reportMonth: current.month, reportYear: current.year, locationId: current.locationId, previousStatus: current.status, newStatus: details.status, reviewId: review.id } as Prisma.InputJsonValue } });

    const users = await tx.user.findMany({ where: { active: true, OR: decision === "APPROVE" ? [{ role: "GAA" }] : decision === "REJECT" ? [{ role: "GAA" }, { role: "EVALUATING_OFFICER", evaluatingOfficerAssignments: { some: { locationId: current.locationId, active: true } } }] : [{ role: "EVALUATING_OFFICER", evaluatingOfficerAssignments: { some: { locationId: current.locationId, active: true } } }] }, select: { id: true, role: true } });
    const messageBase = `${current.location.name} - ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(current.year, current.month - 1, 1)))} monthly report`;
    for (const user of users) {
      await tx.notification.create({ data: { recipientUserId: user.id, event: details.event, title: details.title, message: `${messageBase} ${decision === "APPROVE" ? "has been approved by Administration." : decision === "CORRECTION" ? "requires correction." : "has been rejected."}${remarks ? ` Remarks: ${remarks}` : ""}`, entityType: "EvaluationReport", entityId: reportId, dedupeKey: `admin-review:${review.id}:${user.id}`, metadata: { reportId, reviewId: review.id, decision: details.review } as Prisma.InputJsonValue } });
    }
    return { status: details.status, review };
  });
}
