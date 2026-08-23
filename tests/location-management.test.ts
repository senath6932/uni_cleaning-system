import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateManagedLocation,
  createManagedLocation,
  deleteManagedLocation,
  deactivateManagedLocation,
  listManagedLocations,
  updateManagedLocation,
} from "@/lib/location-management";

type PrismaTxMock = {
  location: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  locationTask: {
    count: ReturnType<typeof vi.fn>;
  };
  workerLocationAssignment: {
    count: ReturnType<typeof vi.fn>;
  };
  evaluatingOfficerAssignment: {
    count: ReturnType<typeof vi.fn>;
  };
  pHIAssignment: {
    count: ReturnType<typeof vi.fn>;
  };
  dailyCleaningEvaluation: {
    count: ReturnType<typeof vi.fn>;
  };
  workerAttendance: {
    count: ReturnType<typeof vi.fn>;
  };
  dailyAttendanceEvaluation: {
    count: ReturnType<typeof vi.fn>;
  };
  monthlyEvaluationReport: {
    count: ReturnType<typeof vi.fn>;
  };
  additionalCleaningTask: {
    count: ReturnType<typeof vi.fn>;
  };
  activityLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

type PrismaMock = PrismaTxMock & {
  $queryRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
};

let prismaMock: PrismaMock;

function createPrismaMock(): PrismaMock {
  return {
    location: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    locationTask: {
      count: vi.fn().mockResolvedValue(0),
    },
    workerLocationAssignment: {
      count: vi.fn().mockResolvedValue(0),
    },
    evaluatingOfficerAssignment: {
      count: vi.fn().mockResolvedValue(0),
    },
    pHIAssignment: {
      count: vi.fn().mockResolvedValue(0),
    },
    dailyCleaningEvaluation: {
      count: vi.fn().mockResolvedValue(0),
    },
    workerAttendance: {
      count: vi.fn().mockResolvedValue(0),
    },
    dailyAttendanceEvaluation: {
      count: vi.fn().mockResolvedValue(0),
    },
    monthlyEvaluationReport: {
      count: vi.fn().mockResolvedValue(0),
    },
    additionalCleaningTask: {
      count: vi.fn().mockResolvedValue(0),
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

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    throw new Error("Supabase admin client should not be used in location management tests.");
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = createPrismaMock();
});

describe("listManagedLocations", () => {
  it("applies search and status filters", async () => {
    prismaMock.location.count.mockResolvedValue(1);
    prismaMock.location.findMany.mockResolvedValue([
      {
        id: "location-1",
        code: "SCI-BLOCK",
        name: "Science Block",
        minimumWorkers: 4,
        active: true,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-02T00:00:00Z"),
      },
    ]);

    const result = await listManagedLocations(
      prismaMock as unknown as Parameters<typeof listManagedLocations>[0],
      {
        query: "Science",
        status: "active",
        page: 1,
        pageSize: 10,
      },
    );

    expect(prismaMock.location.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        active: true,
      }),
    });
    expect(result.total).toBe(1);
    expect(result.locations[0]?.code).toBe("SCI-BLOCK");
  });
});

describe("deleteManagedLocation", () => {
  it("deletes an unused location and logs the audit event", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK",
      name: "Science Block",
    });
    prismaMock.location.delete.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK",
      name: "Science Block",
      minimumWorkers: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await deleteManagedLocation(
      prismaMock as unknown as Parameters<typeof deleteManagedLocation>[0],
      { id: "actor-1", name: "GAA" },
      "location-1",
    );

    expect(prismaMock.location.delete).toHaveBeenCalledWith({
      where: { id: "location-1" },
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "Location",
        entityId: "location-1",
      }),
    });
    expect(result.location.id).toBe("location-1");
  });

  it("rejects deleting locations that still have dependencies", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK",
      name: "Science Block",
    });
    prismaMock.locationTask.count.mockResolvedValue(1);

    await expect(
      deleteManagedLocation(
        prismaMock as unknown as Parameters<typeof deleteManagedLocation>[0],
        { id: "actor-1", name: "GAA" },
        "location-1",
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_IN_USE",
    });
  });
});

describe("createManagedLocation", () => {
  it("creates a valid location and logs the audit event", async () => {
    prismaMock.location.findUnique.mockResolvedValue(null);
    prismaMock.location.create.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK",
      name: "Science Block",
      minimumWorkers: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createManagedLocation(
      prismaMock as unknown as Parameters<typeof createManagedLocation>[0],
      { id: "actor-1", name: "GAA" },
      {
        code: " SCI-BLOCK ",
        name: " Science Block ",
        minimumWorkers: "4",
        active: true,
      },
    );

    expect(prismaMock.location.create).toHaveBeenCalledWith({
      data: {
        code: "SCI-BLOCK",
        name: "Science Block",
        minimumWorkers: 4,
        active: true,
      },
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_CREATED",
        entityType: "Location",
        entityId: "location-1",
      }),
    });
    expect(result.location.code).toBe("SCI-BLOCK");
  });

  it("rejects duplicate codes", async () => {
    prismaMock.location.findUnique.mockResolvedValue({
      id: "existing-location",
    });

    await expect(
      createManagedLocation(
        prismaMock as unknown as Parameters<typeof createManagedLocation>[0],
        { id: "actor-1", name: "GAA" },
        {
          code: "SCI-BLOCK",
          name: "Science Block",
          minimumWorkers: 2,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_CODE_EXISTS",
    });
  });

  it("rejects missing names", async () => {
    prismaMock.location.findUnique.mockResolvedValue(null);

    await expect(
      createManagedLocation(
        prismaMock as unknown as Parameters<typeof createManagedLocation>[0],
        { id: "actor-1", name: "GAA" },
        {
          code: "SCI-BLOCK",
          name: "   ",
          minimumWorkers: 2,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_NAME",
    });
  });

  it("rejects invalid minimum workers", async () => {
    prismaMock.location.findUnique.mockResolvedValue(null);

    await expect(
      createManagedLocation(
        prismaMock as unknown as Parameters<typeof createManagedLocation>[0],
        { id: "actor-1", name: "GAA" },
        {
          code: "SCI-BLOCK",
          name: "Science Block",
          minimumWorkers: -1,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_MINIMUM_WORKERS",
    });
  });
});

describe("updateManagedLocation", () => {
  it("updates code, name, minimum workers, and active status", async () => {
    prismaMock.location.findUnique.mockImplementation(async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id === "location-1") {
        return {
          id: "location-1",
          code: "SCI-BLOCK",
          name: "Science Block",
          minimumWorkers: 4,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return null;
    });
    prismaMock.location.update.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK-2",
      name: "Science Block Annex",
      minimumWorkers: 6,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await updateManagedLocation(
      prismaMock as unknown as Parameters<typeof updateManagedLocation>[0],
      { id: "actor-1", name: "GAA" },
      "location-1",
      {
        code: "SCI-BLOCK-2",
        name: "Science Block Annex",
        minimumWorkers: 6,
        active: false,
      },
    );

    expect(prismaMock.location.update).toHaveBeenCalledWith({
      where: { id: "location-1" },
      data: {
        code: "SCI-BLOCK-2",
        name: "Science Block Annex",
        minimumWorkers: 6,
        active: false,
      },
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_DEACTIVATED",
        entityType: "Location",
        entityId: "location-1",
      }),
    });
    expect(result.location.active).toBe(false);
  });

  it("rejects duplicate codes on update", async () => {
    prismaMock.location.findUnique.mockImplementation(async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id === "location-1") {
        return {
          id: "location-1",
          code: "SCI-BLOCK",
          name: "Science Block",
          minimumWorkers: 4,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      if (where.code === "LIBRARY") {
        return { id: "other-location" };
      }

      return null;
    });

    await expect(
      updateManagedLocation(
        prismaMock as unknown as Parameters<typeof updateManagedLocation>[0],
        { id: "actor-1", name: "GAA" },
        "location-1",
        {
          code: "LIBRARY",
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_CODE_EXISTS",
    });
  });

  it("rejects invalid IDs", async () => {
    prismaMock.location.findUnique.mockResolvedValue(null);

    await expect(
      updateManagedLocation(
        prismaMock as unknown as Parameters<typeof updateManagedLocation>[0],
        { id: "actor-1", name: "GAA" },
        "missing-location",
        {
          name: "Updated Name",
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_NOT_FOUND",
    });
  });

  it("activates and deactivates locations without deleting them", async () => {
    prismaMock.location.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === "location-1") {
        return {
          id: "location-1",
          code: "SCI-BLOCK",
          name: "Science Block",
          minimumWorkers: 4,
          active: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return null;
    });
    prismaMock.location.update.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK",
      name: "Science Block",
      minimumWorkers: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const activated = await activateManagedLocation(
      prismaMock as unknown as Parameters<typeof activateManagedLocation>[0],
      { id: "actor-1", name: "GAA" },
      "location-1",
    );

    expect(activated.location.active).toBe(true);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_ACTIVATED",
      }),
    });

    prismaMock.location.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === "location-1") {
        return {
          id: "location-1",
          code: "SCI-BLOCK",
          name: "Science Block",
          minimumWorkers: 4,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return null;
    });
    prismaMock.location.update.mockResolvedValue({
      id: "location-1",
      code: "SCI-BLOCK",
      name: "Science Block",
      minimumWorkers: 4,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const deactivated = await deactivateManagedLocation(
      prismaMock as unknown as Parameters<typeof deactivateManagedLocation>[0],
      { id: "actor-1", name: "GAA" },
      "location-1",
    );

    expect(deactivated.location.active).toBe(false);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOCATION_DEACTIVATED",
      }),
    });
  });
});
