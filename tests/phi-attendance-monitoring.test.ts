import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { savePHIAttendanceEvaluation } from "@/lib/phi-attendance-monitoring";

type PrismaMock = {
  pHIAssignment: {
    findFirst: Mock;
    findMany: Mock;
  };
  location: {
    findUnique: Mock;
  };
  workerLocationAssignment: {
    count: Mock;
  };
  dailyAttendanceEvaluation: {
    findFirst: Mock;
    findMany: Mock;
    create: Mock;
    update: Mock;
  };
  activityLog: {
    create: Mock;
  };
  $transaction: Mock;
};

const phi = {
  id: "phi-1",
  name: "PHI One",
  role: "PHI" as const,
  active: true,
};

const locationId = "location-1";
const attendanceDate = "2026-08-10";

function createPrismaMock(): PrismaMock {
  return {
    pHIAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
    workerLocationAssignment: {
      count: vi.fn(),
    },
    dailyAttendanceEvaluation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: PrismaMock) => Promise<unknown>) => callback(prismaMock)),
  };
}

function createAttendanceRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "attendance-1",
    locationId,
    phiUserId: phi.id,
    attendanceDate: new Date("2026-08-10T00:00:00Z"),
    totalPresentCount: 8,
    remark: "All present",
    finalized: false,
    finalizedAt: null,
    lockedAt: null,
    createdAt: new Date("2026-08-10T01:00:00Z"),
    updatedAt: new Date("2026-08-10T01:00:00Z"),
    location: {
      id: locationId,
      code: "LIB",
      name: "Library",
    },
    ...overrides,
  };
}

let prismaMock: PrismaMock;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = createPrismaMock();
});

describe("savePHIAttendanceEvaluation", () => {
  it("rejects future dates and unauthorized locations", async () => {
    await expect(
      savePHIAttendanceEvaluation(
        prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
        phi,
        {
          locationId,
          attendanceDate: "2999-01-01",
          totalPresentCount: 8,
        },
      ),
    ).rejects.toMatchObject({ code: "FUTURE_DATE" });

    prismaMock.pHIAssignment.findFirst.mockResolvedValue(null);
    prismaMock.location.findUnique.mockResolvedValue({
      id: locationId,
      code: "LIB",
      name: "Library",
      active: true,
    });

    await expect(
      savePHIAttendanceEvaluation(
        prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
        phi,
        {
          locationId,
          attendanceDate,
          totalPresentCount: 8,
        },
      ),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("rejects invalid counts and inactive PHI users", async () => {
    prismaMock.pHIAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.location.findUnique.mockResolvedValue({
      id: locationId,
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.dailyAttendanceEvaluation.findFirst.mockResolvedValue(null);

    await expect(
      savePHIAttendanceEvaluation(
        prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
        { ...phi, active: false },
        {
          locationId,
          attendanceDate,
          totalPresentCount: 8,
        },
      ),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    await expect(
      savePHIAttendanceEvaluation(
        prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
        phi,
        {
          locationId,
          attendanceDate,
          totalPresentCount: "22.5",
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_COUNT" });
  });

  it("creates and finalizes an attendance record", async () => {
    prismaMock.pHIAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.location.findUnique.mockResolvedValue({
      id: locationId,
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.dailyAttendanceEvaluation.findFirst.mockResolvedValue(null);
    const finalizedAt = new Date("2026-08-10T02:00:00Z");
    prismaMock.dailyAttendanceEvaluation.create.mockResolvedValue(
      createAttendanceRecord({ finalized: true, finalizedAt, lockedAt: finalizedAt }),
    );

    const result = await savePHIAttendanceEvaluation(
      prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
      phi,
      {
        locationId,
        attendanceDate,
        totalPresentCount: 8,
        remark: "All present",
        finalize: true,
      },
    );

    expect(prismaMock.dailyAttendanceEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationId,
          phiUserId: phi.id,
          totalPresentCount: 8,
          remark: "All present",
          finalized: true,
          finalizedAt: expect.any(Date),
          lockedAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ATTENDANCE_EVALUATION_FINALIZED",
        entityType: "DailyAttendanceEvaluation",
      }),
    });
    expect(result.finalized).toBe(true);
  });

  it("prevents duplicate attendance records", async () => {
    prismaMock.pHIAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.location.findUnique.mockResolvedValue({
      id: locationId,
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.dailyAttendanceEvaluation.findFirst.mockResolvedValue(null);
    prismaMock.dailyAttendanceEvaluation.create.mockImplementation(() => {
      const error = new Error("duplicate");
      (error as Error & { code?: string }).code = "P2002";
      throw error;
    });

    await expect(
      savePHIAttendanceEvaluation(
        prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
        phi,
        {
          locationId,
          attendanceDate,
          totalPresentCount: 8,
        },
      ),
    ).rejects.toMatchObject({ code: "ATTENDANCE_EXISTS" });
  });

  it("blocks updates to finalized attendance", async () => {
    prismaMock.pHIAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.location.findUnique.mockResolvedValue({
      id: locationId,
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.dailyAttendanceEvaluation.findFirst.mockResolvedValue({
      ...createAttendanceRecord(),
      lockedAt: new Date("2026-08-10T03:00:00Z"),
      finalizedAt: new Date("2026-08-10T03:00:00Z"),
    });

    await expect(
      savePHIAttendanceEvaluation(
        prismaMock as unknown as Parameters<typeof savePHIAttendanceEvaluation>[0],
        phi,
        {
          locationId,
          attendanceDate,
          totalPresentCount: 7,
        },
      ),
    ).rejects.toMatchObject({ code: "ATTENDANCE_FINALIZED" });
  });
});
