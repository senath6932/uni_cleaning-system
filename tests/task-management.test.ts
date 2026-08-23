import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  activateManagedTask,
  createManagedTask,
  deactivateManagedTask,
  listManagedTasks,
  updateManagedTask,
} from "@/lib/task-management";

type PrismaTxMock = {
  cleaningTask: {
    count: Mock;
    findMany: Mock;
    findUnique: Mock;
    findFirst: Mock;
    create: Mock;
    update: Mock;
  };
  activityLog: {
    create: Mock;
  };
};

type PrismaMock = PrismaTxMock & {
  $queryRaw: Mock;
  $transaction: Mock;
};

let prismaMock: PrismaMock;

function createPrismaMock(): PrismaMock {
  return {
    cleaningTask: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ exists: true }]),
    $transaction: vi.fn(async (callback: (tx: PrismaTxMock) => Promise<unknown>) =>
      callback(prismaMock),
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = createPrismaMock();
});

describe("listManagedTasks", () => {
  it("applies search, frequency, and status filters", async () => {
    prismaMock.cleaningTask.count.mockResolvedValue(1);
    prismaMock.cleaningTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        name: "Floor Cleaning",
        category: "DAILY",
        frequency: "DAILY",
        active: true,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-02T00:00:00Z"),
      },
    ]);

    const result = await listManagedTasks(
      prismaMock as unknown as Parameters<typeof listManagedTasks>[0],
      {
        query: "Floor",
        frequency: "DAILY",
        status: "active",
        page: 1,
        pageSize: 10,
      },
    );

    expect(prismaMock.cleaningTask.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        frequency: "DAILY",
        active: true,
      }),
    });
    expect(result.total).toBe(1);
    expect(result.tasks[0]?.name).toBe("Floor Cleaning");
  });
});

describe("createManagedTask", () => {
  it("creates a valid task and logs the audit event", async () => {
    prismaMock.cleaningTask.findFirst.mockResolvedValue(null);
    prismaMock.cleaningTask.create.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createManagedTask(
      prismaMock as unknown as Parameters<typeof createManagedTask>[0],
      { id: "actor-1", name: "GAA" },
      {
        name: " Floor Cleaning ",
        frequency: "DAILY",
        active: true,
      },
    );

    expect(prismaMock.cleaningTask.create).toHaveBeenCalledWith({
      data: {
        name: "Floor Cleaning",
        category: "DAILY",
        frequency: "DAILY",
        active: true,
      },
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLEANING_TASK_CREATED",
        entityType: "CleaningTask",
        entityId: "task-1",
      }),
    });
    expect(result.task.name).toBe("Floor Cleaning");
  });

  it("rejects duplicate names", async () => {
    prismaMock.cleaningTask.findFirst.mockResolvedValue({
      id: "existing-task",
    });

    await expect(
      createManagedTask(
        prismaMock as unknown as Parameters<typeof createManagedTask>[0],
        { id: "actor-1", name: "GAA" },
        {
          name: "Floor Cleaning",
          frequency: "DAILY",
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "TASK_NAME_EXISTS",
    });
  });

  it("rejects missing names", async () => {
    prismaMock.cleaningTask.findFirst.mockResolvedValue(null);

    await expect(
      createManagedTask(
        prismaMock as unknown as Parameters<typeof createManagedTask>[0],
        { id: "actor-1", name: "GAA" },
        {
          name: "   ",
          frequency: "DAILY",
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_NAME",
    });
  });

  it("rejects invalid frequency values", async () => {
    prismaMock.cleaningTask.findFirst.mockResolvedValue(null);

    await expect(
      createManagedTask(
        prismaMock as unknown as Parameters<typeof createManagedTask>[0],
        { id: "actor-1", name: "GAA" },
        {
          name: "Floor Cleaning",
          frequency: "YEARLY",
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_FREQUENCY",
    });
  });
});

describe("updateManagedTask", () => {
  it("updates name, frequency, and active state", async () => {
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.cleaningTask.findFirst.mockResolvedValue(null);
    prismaMock.cleaningTask.update.mockResolvedValue({
      id: "task-1",
      name: "Deep Floor Cleaning",
      category: "MONTHLY",
      frequency: "MONTHLY",
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await updateManagedTask(
      prismaMock as unknown as Parameters<typeof updateManagedTask>[0],
      { id: "actor-1", name: "GAA" },
      "task-1",
      {
        name: "Deep Floor Cleaning",
        frequency: "MONTHLY",
        active: false,
      },
    );

    expect(prismaMock.cleaningTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: {
        name: "Deep Floor Cleaning",
        frequency: "MONTHLY",
        category: "MONTHLY",
        active: false,
      },
    });
    expect(result.task.frequency).toBe("MONTHLY");
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLEANING_TASK_UPDATED",
        entityId: "task-1",
      }),
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLEANING_TASK_DEACTIVATED",
        entityId: "task-1",
      }),
    });
  });

  it("rejects invalid IDs", async () => {
    prismaMock.cleaningTask.findUnique.mockResolvedValue(null);

    await expect(
      updateManagedTask(
        prismaMock as unknown as Parameters<typeof updateManagedTask>[0],
        { id: "actor-1", name: "GAA" },
        "missing-task",
        {
          name: "Updated",
        },
      ),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("rejects invalid frequency updates", async () => {
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      updateManagedTask(
        prismaMock as unknown as Parameters<typeof updateManagedTask>[0],
        { id: "actor-1", name: "GAA" },
        "task-1",
        {
          frequency: "YEARLY",
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_FREQUENCY",
    });
  });

  it("rejects duplicate names on update", async () => {
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.cleaningTask.findFirst.mockResolvedValue({ id: "task-2" });

    await expect(
      updateManagedTask(
        prismaMock as unknown as Parameters<typeof updateManagedTask>[0],
        { id: "actor-1", name: "GAA" },
        "task-1",
        {
          name: "Windows Cleaning",
        },
      ),
    ).rejects.toMatchObject({
      code: "TASK_NAME_EXISTS",
    });
  });

  it("activates and deactivates tasks", async () => {
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.cleaningTask.update.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const activated = await activateManagedTask(
      prismaMock as unknown as Parameters<typeof activateManagedTask>[0],
      { id: "actor-1", name: "GAA" },
      "task-1",
    );

    expect(activated.task.active).toBe(true);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLEANING_TASK_ACTIVATED",
      }),
    });

    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.cleaningTask.update.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      category: "DAILY",
      frequency: "DAILY",
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const deactivated = await deactivateManagedTask(
      prismaMock as unknown as Parameters<typeof deactivateManagedTask>[0],
      { id: "actor-1", name: "GAA" },
      "task-1",
    );

    expect(deactivated.task.active).toBe(false);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLEANING_TASK_DEACTIVATED",
      }),
    });
  });
});
