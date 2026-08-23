import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import {
  activateManagedLocationTask,
  createManagedLocationTask,
  deactivateManagedLocationTask,
  listManagedLocationTasks,
  updateManagedLocationTask,
} from "@/lib/location-task-management";

type PrismaTxMock = {
  location: {
    findUnique: Mock;
    findMany: Mock;
  };
  cleaningTask: {
    findUnique: Mock;
    findMany: Mock;
  };
  locationTask: {
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
    location: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    cleaningTask: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    locationTask: {
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

describe("listManagedLocationTasks", () => {
  it("filters assignments by search, location, task, and status", async () => {
    prismaMock.locationTask.count.mockResolvedValue(1);
    prismaMock.locationTask.findMany.mockResolvedValue([
      {
        id: "assignment-1",
        locationId: "location-1",
        taskId: "task-1",
        frequency: "DAILY",
        allocatedAmount: new Prisma.Decimal("50000.00"),
        active: true,
        isAdditional: false,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-02T00:00:00Z"),
        location: {
          id: "location-1",
          code: "LIB",
          name: "Library",
          active: true,
        },
        task: {
          id: "task-1",
          name: "Floor Cleaning",
          frequency: "DAILY",
          active: true,
        },
      },
    ]);

    const result = await listManagedLocationTasks(
      prismaMock as unknown as Parameters<typeof listManagedLocationTasks>[0],
      {
        query: "Library",
        locationId: "location-1",
        taskId: "task-1",
        status: "active",
        page: 1,
        pageSize: 10,
      },
    );

    expect(prismaMock.locationTask.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        locationId: "location-1",
        taskId: "task-1",
        active: true,
      }),
    });
    expect(result.total).toBe(1);
    expect(result.locationTasks[0]?.location.code).toBe("LIB");
  });
});

describe("createManagedLocationTask", () => {
  it("creates a valid assignment and logs the audit event", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "location-1",
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      frequency: "DAILY",
      active: true,
    });
    prismaMock.locationTask.findFirst.mockResolvedValue(null);
    prismaMock.locationTask.create.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("50000.00"),
      active: true,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });

    const result = await createManagedLocationTask(
      prismaMock as unknown as Parameters<typeof createManagedLocationTask>[0],
      { id: "actor-1", name: "GAA" },
      {
        locationId: "location-1",
        taskId: "task-1",
        allocatedAmount: "50000.00",
        active: true,
      },
    );

    expect(prismaMock.locationTask.create).toHaveBeenCalledWith({
      data: {
        locationId: "location-1",
        taskId: "task-1",
        frequency: "DAILY",
        allocatedAmount: expect.any(Prisma.Decimal),
        active: true,
        isAdditional: false,
      },
      select: expect.any(Object),
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_TASK_CREATED",
        entityType: "LocationTask",
        entityId: "assignment-1",
      }),
    });
    expect(result.locationTask.location.code).toBe("LIB");
  });

  it("rejects duplicate assignments", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "location-1",
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      frequency: "DAILY",
      active: true,
    });
    prismaMock.locationTask.findFirst.mockResolvedValue({ id: "existing-assignment" });

    await expect(
      createManagedLocationTask(
        prismaMock as unknown as Parameters<typeof createManagedLocationTask>[0],
        { id: "actor-1", name: "GAA" },
        {
          locationId: "location-1",
          taskId: "task-1",
          allocatedAmount: "50000.00",
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_TASK_EXISTS",
    });
  });

  it("rejects inactive locations and tasks", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "location-1",
      code: "LIB",
      name: "Library",
      active: false,
    });
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      frequency: "DAILY",
      active: true,
    });

    await expect(
      createManagedLocationTask(
        prismaMock as unknown as Parameters<typeof createManagedLocationTask>[0],
        { id: "actor-1", name: "GAA" },
        {
          locationId: "location-1",
          taskId: "task-1",
          allocatedAmount: "50000.00",
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_INACTIVE",
    });
  });

  it("rejects mismatched frequency values", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "location-1",
      code: "LIB",
      name: "Library",
      active: true,
    });
    prismaMock.cleaningTask.findUnique.mockResolvedValue({
      id: "task-1",
      name: "Floor Cleaning",
      frequency: "DAILY",
      active: true,
    });
    prismaMock.locationTask.findFirst.mockResolvedValue(null);

    await expect(
      createManagedLocationTask(
        prismaMock as unknown as Parameters<typeof createManagedLocationTask>[0],
        { id: "actor-1", name: "GAA" },
        {
          locationId: "location-1",
          taskId: "task-1",
          allocatedAmount: "50000.00",
          active: true,
          frequency: "WEEKLY",
        },
      ),
    ).rejects.toMatchObject({
      code: "FREQUENCY_MISMATCH",
    });
  });
});

describe("updateManagedLocationTask", () => {
  it("updates the allocated amount and active state", async () => {
    prismaMock.locationTask.findUnique.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("50000.00"),
      active: true,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });
    prismaMock.locationTask.update.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("55000.00"),
      active: false,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });

    const result = await updateManagedLocationTask(
      prismaMock as unknown as Parameters<typeof updateManagedLocationTask>[0],
      { id: "actor-1", name: "GAA" },
      "assignment-1",
      {
        allocatedAmount: "55000.00",
        active: false,
      },
    );

    expect(prismaMock.locationTask.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        allocatedAmount: expect.any(Prisma.Decimal),
        active: false,
      },
      select: expect.any(Object),
    });
    expect(result.locationTask.active).toBe(false);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_TASK_UPDATED",
        entityId: "assignment-1",
      }),
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_TASK_DEACTIVATED",
        entityId: "assignment-1",
      }),
    });
  });

  it("rejects missing assignments", async () => {
    prismaMock.locationTask.findUnique.mockResolvedValue(null);

    await expect(
      updateManagedLocationTask(
        prismaMock as unknown as Parameters<typeof updateManagedLocationTask>[0],
        { id: "actor-1", name: "GAA" },
        "missing-assignment",
        {
          allocatedAmount: "55000.00",
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_TASK_NOT_FOUND",
    });
  });

  it("activates and deactivates assignments", async () => {
    prismaMock.locationTask.findUnique.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("50000.00"),
      active: false,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });
    prismaMock.locationTask.update.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("50000.00"),
      active: true,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });

    const activated = await activateManagedLocationTask(
      prismaMock as unknown as Parameters<typeof activateManagedLocationTask>[0],
      { id: "actor-1", name: "GAA" },
      "assignment-1",
    );

    expect(activated.locationTask.active).toBe(true);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_TASK_ACTIVATED",
      }),
    });

    prismaMock.locationTask.findUnique.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("50000.00"),
      active: true,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });
    prismaMock.locationTask.update.mockResolvedValue({
      id: "assignment-1",
      locationId: "location-1",
      taskId: "task-1",
      frequency: "DAILY",
      allocatedAmount: new Prisma.Decimal("50000.00"),
      active: false,
      isAdditional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: {
        id: "location-1",
        code: "LIB",
        name: "Library",
        active: true,
      },
      task: {
        id: "task-1",
        name: "Floor Cleaning",
        frequency: "DAILY",
        active: true,
      },
    });

    const deactivated = await deactivateManagedLocationTask(
      prismaMock as unknown as Parameters<typeof deactivateManagedLocationTask>[0],
      { id: "actor-1", name: "GAA" },
      "assignment-1",
    );

    expect(deactivated.locationTask.active).toBe(false);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_TASK_DEACTIVATED",
      }),
    });
  });
});
