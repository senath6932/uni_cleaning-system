import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  activateManagedEvaluatingOfficerAssignment,
  canEvaluatingOfficerAccessLocation,
  createManagedEvaluatingOfficerAssignment,
  deactivateManagedEvaluatingOfficerAssignment,
  listManagedEvaluatingOfficerAssignments,
  updateManagedEvaluatingOfficerAssignment,
} from "@/lib/evaluating-officer-assignments";

type PrismaTxMock = {
  user: {
    findUnique: Mock;
    findMany: Mock;
  };
  location: {
    findUnique: Mock;
    findMany: Mock;
  };
  evaluatingOfficerAssignment: {
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

const officer = {
  id: "user-1",
  name: "Jane Officer",
  email: "jane@example.com",
  role: "EVALUATING_OFFICER" as const,
  active: true,
};

const inactiveOfficer = {
  ...officer,
  active: false,
};

const location = {
  id: "location-1",
  code: "LIB",
  name: "Library",
  active: true,
};

const inactiveLocation = {
  ...location,
  active: false,
};

function assignmentRecord(active = true) {
  return {
    id: "assignment-1",
    userId: officer.id,
    locationId: location.id,
    active,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-02T00:00:00Z"),
    user: officer,
    location,
  };
}

function createPrismaMock(): PrismaMock {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    evaluatingOfficerAssignment: {
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

describe("listManagedEvaluatingOfficerAssignments", () => {
  it("filters assignments by search, officer, location, and status", async () => {
    prismaMock.evaluatingOfficerAssignment.count.mockResolvedValue(1);
    prismaMock.evaluatingOfficerAssignment.findMany.mockResolvedValue([assignmentRecord()]);

    const result = await listManagedEvaluatingOfficerAssignments(
      prismaMock as unknown as Parameters<typeof listManagedEvaluatingOfficerAssignments>[0],
      {
        query: "Jane",
        officerId: officer.id,
        locationId: location.id,
        status: "active",
        page: 1,
        pageSize: 10,
      },
    );

    expect(prismaMock.evaluatingOfficerAssignment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: officer.id,
        locationId: location.id,
        active: true,
      }),
    });
    expect(result.total).toBe(1);
    expect(result.assignments[0]?.user.email).toBe("jane@example.com");
  });
});

describe("createManagedEvaluatingOfficerAssignment", () => {
  it("creates a valid assignment and logs the audit event", async () => {
    prismaMock.user.findUnique.mockResolvedValue(officer);
    prismaMock.location.findUnique.mockResolvedValue(location);
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue(null);
    prismaMock.evaluatingOfficerAssignment.create.mockResolvedValue(assignmentRecord());

    const result = await createManagedEvaluatingOfficerAssignment(
      prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
      { id: "actor-1", name: "GAA" },
      {
        userId: officer.id,
        locationId: location.id,
        active: true,
      },
    );

    expect(prismaMock.evaluatingOfficerAssignment.create).toHaveBeenCalledWith({
      data: {
        userId: officer.id,
        locationId: location.id,
        active: true,
      },
      select: expect.any(Object),
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "EVALUATING_OFFICER_ASSIGNED",
        entityType: "EvaluatingOfficerAssignment",
        entityId: "assignment-1",
      }),
    });
    expect(result.operation).toBe("created");
  });

  it("reactivates an inactive assignment instead of creating a duplicate", async () => {
    prismaMock.user.findUnique.mockResolvedValue(officer);
    prismaMock.location.findUnique.mockResolvedValue(location);
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue(assignmentRecord(false));
    prismaMock.evaluatingOfficerAssignment.update.mockResolvedValue(assignmentRecord(true));

    const result = await createManagedEvaluatingOfficerAssignment(
      prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
      { id: "actor-1", name: "GAA" },
      {
        userId: officer.id,
        locationId: location.id,
        active: true,
      },
    );

    expect(prismaMock.evaluatingOfficerAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { active: true },
      select: expect.any(Object),
    });
    expect(result.operation).toBe("reactivated");
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "EVALUATING_OFFICER_ASSIGNMENT_ACTIVATED",
      }),
    });
  });

  it("returns the existing inactive assignment when no active change is requested", async () => {
    prismaMock.user.findUnique.mockResolvedValue(officer);
    prismaMock.location.findUnique.mockResolvedValue(location);
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue(assignmentRecord(false));

    const result = await createManagedEvaluatingOfficerAssignment(
      prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
      { id: "actor-1", name: "GAA" },
      {
        userId: officer.id,
        locationId: location.id,
        active: false,
      },
    );

    expect(result.operation).toBe("existing");
    expect(prismaMock.evaluatingOfficerAssignment.update).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate active assignments", async () => {
    prismaMock.user.findUnique.mockResolvedValue(officer);
    prismaMock.location.findUnique.mockResolvedValue(location);
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue(assignmentRecord(true));

    await expect(
      createManagedEvaluatingOfficerAssignment(
        prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
        { id: "actor-1", name: "GAA" },
        {
          userId: officer.id,
          locationId: location.id,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "ASSIGNMENT_EXISTS",
    });
  });

  it("rejects non-officer roles and inactive records", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...officer,
      role: "PHI",
    });
    prismaMock.location.findUnique.mockResolvedValue(location);

    await expect(
      createManagedEvaluatingOfficerAssignment(
        prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
        { id: "actor-1", name: "GAA" },
        {
          userId: officer.id,
          locationId: location.id,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_OFFICER_ROLE",
    });

    prismaMock.user.findUnique.mockResolvedValue(inactiveOfficer);
    prismaMock.location.findUnique.mockResolvedValue(location);

    await expect(
      createManagedEvaluatingOfficerAssignment(
        prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
        { id: "actor-1", name: "GAA" },
        {
          userId: officer.id,
          locationId: location.id,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "OFFICER_INACTIVE",
    });

    prismaMock.user.findUnique.mockResolvedValue(officer);
    prismaMock.location.findUnique.mockResolvedValue(inactiveLocation);

    await expect(
      createManagedEvaluatingOfficerAssignment(
        prismaMock as unknown as Parameters<typeof createManagedEvaluatingOfficerAssignment>[0],
        { id: "actor-1", name: "GAA" },
        {
          userId: officer.id,
          locationId: location.id,
          active: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "LOCATION_INACTIVE",
    });
  });
});

describe("updateManagedEvaluatingOfficerAssignment", () => {
  it("activates and deactivates assignments", async () => {
    prismaMock.evaluatingOfficerAssignment.findUnique.mockResolvedValue(assignmentRecord(true));
    prismaMock.evaluatingOfficerAssignment.update.mockResolvedValue(assignmentRecord(false));

    const deactivated = await deactivateManagedEvaluatingOfficerAssignment(
      prismaMock as unknown as Parameters<typeof deactivateManagedEvaluatingOfficerAssignment>[0],
      { id: "actor-1", name: "GAA" },
      "assignment-1",
    );

    expect(deactivated.assignment.active).toBe(false);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "EVALUATING_OFFICER_ASSIGNMENT_DEACTIVATED",
      }),
    });

    prismaMock.evaluatingOfficerAssignment.findUnique.mockResolvedValue(assignmentRecord(false));
    prismaMock.evaluatingOfficerAssignment.update.mockResolvedValue(assignmentRecord(true));

    const activated = await activateManagedEvaluatingOfficerAssignment(
      prismaMock as unknown as Parameters<typeof activateManagedEvaluatingOfficerAssignment>[0],
      { id: "actor-1", name: "GAA" },
      "assignment-1",
    );

    expect(activated.assignment.active).toBe(true);
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "EVALUATING_OFFICER_ASSIGNMENT_ACTIVATED",
      }),
    });
  });

  it("rejects missing assignments", async () => {
    prismaMock.evaluatingOfficerAssignment.findUnique.mockResolvedValue(null);

    await expect(
      updateManagedEvaluatingOfficerAssignment(
        prismaMock as unknown as Parameters<typeof updateManagedEvaluatingOfficerAssignment>[0],
        { id: "actor-1", name: "GAA" },
        "missing-assignment",
        { active: false },
      ),
    ).rejects.toMatchObject({
      code: "ASSIGNMENT_NOT_FOUND",
    });
  });
});

describe("canEvaluatingOfficerAccessLocation", () => {
  it("checks active assignments for later authorization use", async () => {
    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });

    await expect(
      canEvaluatingOfficerAccessLocation(
        prismaMock as unknown as Parameters<typeof canEvaluatingOfficerAccessLocation>[0],
        officer.id,
        location.id,
      ),
    ).resolves.toBe(true);

    prismaMock.evaluatingOfficerAssignment.findFirst.mockResolvedValue(null);

    await expect(
      canEvaluatingOfficerAccessLocation(
        prismaMock as unknown as Parameters<typeof canEvaluatingOfficerAccessLocation>[0],
        officer.id,
        location.id,
      ),
    ).resolves.toBe(false);
  });
});
