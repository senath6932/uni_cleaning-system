import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { getBusinessDateString } from "@/lib/business-date";
import { saveOfficerEvaluations } from "@/lib/evaluating-officer-monitoring";

type PrismaMock = {
  evaluatingOfficerAssignment: {
    findFirst: Mock;
  };
  locationTask: {
    findMany: Mock;
  };
  dailyCleaningEvaluation: {
    findMany: Mock;
    create: Mock;
    update: Mock;
  };
  activityLog: {
    create: Mock;
  };
  $transaction: Mock;
};

const officer = {
  id: "officer-1",
  name: "Officer One",
  role: "EVALUATING_OFFICER" as const,
  active: true,
};

const todayString = getBusinessDateString();
const todayDate = new Date(`${todayString}T00:00:00Z`);
const yesterdayString = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const tomorrowString = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const locationId = "location-1";
const taskId = "location-task-1";
const taskDate = new Date(`${todayString}T00:00:00Z`);

function createLocationTask() {
  return {
    id: taskId,
    active: true,
    frequency: "DAILY" as const,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    task: {
      id: "task-1",
      name: "Main Hall",
      frequency: "DAILY" as const,
      active: true,
    },
    location: {
      id: locationId,
      code: "LIB",
      name: "Library",
      active: true,
    },
  };
}

function createEvaluationRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "evaluation-1",
    locationId,
    locationTaskId: taskId,
    evaluatingOfficerId: officer.id,
    evaluationDate: taskDate,
    occurrenceKey: "default",
    result: "P",
    remark: "Good",
    createdAt: new Date(`${todayString}T01:00:00Z`),
    updatedAt: new Date(`${todayString}T01:00:00Z`),
    finalizedAt: null,
    lockedAt: null,
    location: {
      id: locationId,
      code: "LIB",
      name: "Library",
    },
    locationTask: {
      id: taskId,
      frequency: "DAILY" as const,
      task: {
        id: "task-1",
        name: "Main Hall",
        frequency: "DAILY" as const,
      },
    },
    ...overrides,
  };
}

function createPrismaMock(): PrismaMock {
  return {
    evaluatingOfficerAssignment: {
      findFirst: vi.fn(),
    },
    locationTask: {
      findMany: vi.fn(),
    },
    dailyCleaningEvaluation: {
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

let prismaMock: PrismaMock;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = createPrismaMock();
});

describe("saveOfficerEvaluations", () => {
  it("rejects past and future dates and unauthorized locations", async () => {
    await expect(
      saveOfficerEvaluations(
        prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
        officer,
        {
          locationId,
          evaluationDate: tomorrowString,
          items: [],
        },
      ),
    ).rejects.toMatchObject({ code: "FUTURE_DATE" });

    await expect(
      saveOfficerEvaluations(
        prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
        officer,
        {
          locationId,
          evaluationDate: yesterdayString,
          items: [],
        },
      ),
    ).rejects.toMatchObject({ code: "PAST_DATE" });

    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue(null);
    prismaMock.locationTask.findMany.mockResolvedValue([createLocationTask()]);
    prismaMock.dailyCleaningEvaluation.findMany.mockResolvedValue([]);

    await expect(
      saveOfficerEvaluations(
        prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
        officer,
        {
          locationId,
          evaluationDate: todayString,
          items: [{ locationTaskId: taskId, result: "P" }],
        },
      ),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("rejects invalid evaluation results and inactive officers", async () => {
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.locationTask.findMany.mockResolvedValue([createLocationTask()]);
    prismaMock.dailyCleaningEvaluation.findMany.mockResolvedValue([]);

    await expect(
      saveOfficerEvaluations(
        prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
        { ...officer, active: false },
        {
          locationId,
          evaluationDate: todayString,
          items: [{ locationTaskId: taskId, result: "P" }],
        },
      ),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    await expect(
      saveOfficerEvaluations(
        prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
        officer,
        {
          locationId,
          evaluationDate: todayString,
          items: [{ locationTaskId: taskId, result: "BAD" }],
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESULT" });
  });

  it("creates and finalizes a daily evaluation", async () => {
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.locationTask.findMany.mockResolvedValue([createLocationTask()]);
    prismaMock.dailyCleaningEvaluation.findMany.mockResolvedValue([]);
    const finalizedAt = new Date(`${todayString}T02:00:00Z`);
    prismaMock.dailyCleaningEvaluation.create.mockResolvedValue(
      createEvaluationRecord({ finalizedAt, lockedAt: finalizedAt }),
    );

    const result = await saveOfficerEvaluations(
      prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
      officer,
      {
        locationId,
        evaluationDate: todayString,
        finalize: true,
        items: [{ locationTaskId: taskId, result: "P", remark: "Looks clean" }],
      },
    );

    expect(prismaMock.dailyCleaningEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationId,
          locationTaskId: taskId,
          evaluatingOfficerId: officer.id,
          result: "P",
          remark: "Looks clean",
          finalizedAt: expect.any(Date),
          lockedAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DAILY_EVALUATION_FINALIZED",
        entityType: "DailyCleaningEvaluation",
      }),
    });
    expect(result.evaluations[0]?.finalized).toBe(true);
  });

  it("updates an existing evaluation instead of creating a duplicate", async () => {
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    prismaMock.locationTask.findMany.mockResolvedValue([createLocationTask()]);
    prismaMock.dailyCleaningEvaluation.findMany
      .mockResolvedValueOnce([createEvaluationRecord({ result: "P", remark: "Good" })])
      .mockResolvedValueOnce([createEvaluationRecord({ result: "P", remark: "Good" })]);
    prismaMock.dailyCleaningEvaluation.update.mockResolvedValue(
      createEvaluationRecord({ result: "X", remark: "Needs attention", updatedAt: new Date(`${todayString}T02:00:00Z`) }),
    );

    const result = await saveOfficerEvaluations(
      prismaMock as unknown as Parameters<typeof saveOfficerEvaluations>[0],
      officer,
      {
        locationId,
        evaluationDate: todayString,
        items: [{ locationTaskId: taskId, result: "X", remark: "Needs attention" }],
      },
    );

    expect(prismaMock.dailyCleaningEvaluation.update).toHaveBeenCalled();
    expect(prismaMock.dailyCleaningEvaluation.create).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DAILY_EVALUATION_UPDATED",
      }),
    });
    expect(result.evaluations[0]?.result).toBe("X");
  });
});
