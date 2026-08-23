import { describe, expect, it, vi } from "vitest";
import { decideMonthlyReport } from "@/lib/administration-review";

const actor = { id: "admin-1", name: "Admin", role: "ADMINISTRATION_OFFICER" as const, active: true };
const report = { id: "report-1", locationId: "location-1", month: 8, year: 2026, status: "SUBMITTED" as const, location: { id: "location-1", code: "SCI", name: "Science Block" } };

function mockPrisma(status: string = report.status, changed = 1) {
  const tx = {
    monthlyEvaluationReport: {
      findUnique: vi.fn(async () => ({ ...report, status })),
      updateMany: vi.fn(async () => ({ count: changed })),
    },
    administrationReview: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "review-1", ...data })) },
    activityLog: { create: vi.fn(async () => undefined) },
    user: { findMany: vi.fn(async () => [{ id: "gaa-1", role: "GAA" }, { id: "officer-1", role: "EVALUATING_OFFICER" }]) },
    notification: { create: vi.fn(async () => undefined) },
  };
  return { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)), tx };
}

describe("Administration Officer review workflow", () => {
  it("approves a submitted report with optional remarks and creates audit notifications", async () => {
    const prisma = mockPrisma();
    const result = await decideMonthlyReport(prisma as never, actor, report.id, "APPROVE", "Verified.");
    expect(result.status).toBe("ADMIN_APPROVED");
    expect(prisma.tx.administrationReview.create).toHaveBeenCalledWith({ data: expect.objectContaining({ decision: "APPROVE", remarks: "Verified." }) });
    expect(prisma.tx.activityLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "ADMIN_APPROVED" }) });
    expect(prisma.tx.notification.create).toHaveBeenCalled();
  });

  it("allows approval without remarks", async () => {
    const prisma = mockPrisma();
    await expect(decideMonthlyReport(prisma as never, actor, report.id, "APPROVE")).resolves.toMatchObject({ status: "ADMIN_APPROVED" });
  });

  it("supports resubmitted reports", async () => {
    const prisma = mockPrisma("RESUBMITTED");
    await expect(decideMonthlyReport(prisma as never, actor, report.id, "APPROVE")).resolves.toMatchObject({ status: "ADMIN_APPROVED" });
  });

  it("requires correction and rejection remarks", async () => {
    const prisma = mockPrisma();
    await expect(decideMonthlyReport(prisma as never, actor, report.id, "CORRECTION", "  ")).rejects.toMatchObject({ message: "Correction remarks are required." });
    await expect(decideMonthlyReport(prisma as never, actor, report.id, "REJECT", "")).rejects.toMatchObject({ message: "Rejection remarks are required." });
  });

  it.each(["GAA", "EVALUATING_OFFICER", "PHI", "VICE_CHANCELLOR"] as const)("rejects %s from making a decision", async (role) => {
    const prisma = mockPrisma();
    await expect(decideMonthlyReport(prisma as never, { ...actor, role }, report.id, "APPROVE")).rejects.toMatchObject({ status: 403 });
  });

  it.each(["DRAFT", "CORRECTION_REQUESTED", "ADMIN_APPROVED", "ADMIN_REJECTED", "VC_PENDING"] as const)("rejects non-reviewable status %s", async (status) => {
    const prisma = mockPrisma(status as never);
    await expect(decideMonthlyReport(prisma as never, actor, report.id, "APPROVE")).rejects.toMatchObject({ message: "This report is not available for Administration review." });
  });

  it("rejects a concurrent decision after the conditional status update loses the race", async () => {
    const prisma = mockPrisma("SUBMITTED", 0);
    await expect(decideMonthlyReport(prisma as never, actor, report.id, "REJECT", "Not acceptable")).rejects.toMatchObject({ message: "This report has already been reviewed." });
    expect(prisma.tx.administrationReview.create).not.toHaveBeenCalled();
  });
});
