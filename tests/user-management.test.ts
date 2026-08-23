import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  assertAllowedRole,
  createManagedUser,
  deactivateManagedUser,
  listManagedUsers,
  updateManagedUser,
  deleteManagedUser,
  UserManagementError,
} from "@/lib/user-management";

const adminClient = {
  auth: {
    admin: {
      listUsers: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminClient,
}));

type PrismaMock = {
  user: {
    count: Mock;
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
  activityLog: {
    create: Mock;
    deleteMany: Mock;
  };
  notification: {
    deleteMany: Mock;
  };
  $queryRaw: Mock;
  $transaction: Mock;
};

function createPrismaMock(): PrismaMock {
  return {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: {
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ exists: true }]),
    $transaction: vi.fn(
      async (callback: (tx: ReturnType<typeof createPrismaMock>) => Promise<unknown>) =>
        callback(prismaMock),
    ),
  };
}

let prismaMock: PrismaMock;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = createPrismaMock();
});

describe("user role validation", () => {
  it("rejects invalid roles", () => {
    expect(() => assertAllowedRole("ADMIN")).toThrow(UserManagementError);
  });

  it("accepts allowed roles", () => {
    expect(() => assertAllowedRole("GAA")).not.toThrow();
  });
});

describe("listManagedUsers", () => {
  it("applies search and status filters", async () => {
    prismaMock.user.count.mockResolvedValue(1);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Jane Doe",
        email: "jane@example.com",
        role: "GAA",
        active: true,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-02T00:00:00Z"),
      },
    ]);

    const result = await listManagedUsers(
      prismaMock as unknown as Parameters<typeof listManagedUsers>[0],
      {
      query: "Jane",
      role: "GAA",
      status: "active",
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
      },
    );

    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: "GAA",
        active: true,
      }),
    });
    expect(result.total).toBe(1);
    expect(result.users[0]?.email).toBe("jane@example.com");
  });
});

describe("createManagedUser", () => {
  it("creates the auth user and application user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    adminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    adminClient.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
      error: null,
    });
    prismaMock.user.create.mockResolvedValue({
      id: "supabase-user-1",
      name: "New User",
      email: "new@example.com",
      role: "GAA",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createManagedUser(
      prismaMock as unknown as Parameters<typeof createManagedUser>[0],
      { id: "actor-1", name: "Admin" },
      {
        name: "New User",
        email: "new@example.com",
        role: "GAA",
        active: true,
        password: "SecurePass123!",
        passwordConfirmation: "SecurePass123!",
      },
    );

    expect(adminClient.auth.admin.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "SecurePass123!",
      email_confirm: true,
      user_metadata: { full_name: "New User", role: "GAA" },
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        id: "supabase-user-1",
        name: "New User",
        email: "new@example.com",
        role: "GAA",
        active: true,
      },
    });
    expect(result.user.id).toBe("supabase-user-1");
  });

  it("rejects duplicate email in PostgreSQL", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "existing",
      name: "Existing",
      email: "existing@example.com",
      role: "GAA",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createManagedUser(
        prismaMock as unknown as Parameters<typeof createManagedUser>[0],
        { id: "actor-1", name: "Admin" },
        {
          name: "New User",
          email: "existing@example.com",
          role: "GAA",
          active: true,
          password: "SecurePass123!",
          passwordConfirmation: "SecurePass123!",
        },
      ),
    ).rejects.toMatchObject({
      code: "EMAIL_EXISTS",
    });
  });
});

describe("updateManagedUser", () => {
  it("updates name, role, and active state", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Old Name",
      email: "person@example.com",
      role: "PHI",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "New Name",
      email: "person@example.com",
      role: "GAA",
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await updateManagedUser(
      prismaMock as unknown as Parameters<typeof updateManagedUser>[0],
      { id: "actor-1", name: "Admin" },
      "user-1",
      {
        name: "New Name",
        role: "GAA",
        active: false,
      },
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "New Name",
        role: "GAA",
        active: false,
      },
    });
    expect(result.user.role).toBe("GAA");
    expect(result.user.active).toBe(false);
  });
});

describe("deactivateManagedUser", () => {
  it("persists active=false in PostgreSQL and records the deactivation", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Person",
      email: "person@example.com",
      role: "PHI",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Person",
      email: "person@example.com",
      role: "PHI",
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await deactivateManagedUser(
      prismaMock as unknown as Parameters<typeof deactivateManagedUser>[0],
      { id: "actor-1", name: "Admin" },
      "user-1",
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { active: false },
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "USER_DEACTIVATED", entityId: "user-1" }),
    });
    expect(result.user.active).toBe(false);
  });
});

describe("deleteManagedUser", () => {
  it("deletes an inactive user and cleans up owned audit records", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      _count: {
        evaluatingOfficerAssignments: 0,
        phiAssignments: 0,
        evaluations: 0,
        attendances: 0,
        dailyAttendanceEvaluations: 0,
        administrationReviews: 0,
        createdRecommendations: 0,
        submittedRecommendations: 0,
        finalizedRecommendations: 0,
        taskCalculationChanges: 0,
        workerCalculationChanges: 0,
        createdAdditionalTasks: 0,
        vcApprovals: 0,
      },
    });
    prismaMock.user.delete.mockResolvedValue({ id: "user-1" });

    const result = await deleteManagedUser(
      prismaMock as unknown as Parameters<typeof deleteManagedUser>[0],
      { id: "actor-1", name: "Admin" },
      "user-1",
    );

    expect(prismaMock.activityLog.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({ where: { recipientUserId: "user-1" } });
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result.user.id).toBe("user-1");
  });
});
