import type {
  ActivityAction,
  Prisma,
  PrismaClient,
  User,
} from "@/app/generated/prisma/client";
import {
  applicationRoles,
  isApplicationRole,
  type ApplicationRole,
} from "@/lib/application-roles";
import { createActivityLogIfSupported } from "@/lib/audit-logging";

export const allowedApplicationRoles = applicationRoles;

export type AllowedApplicationRole = ApplicationRole;

export type UserListFilters = {
  query?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "email" | "role" | "active" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type UserListItem = Pick<
  User,
  "id" | "name" | "email" | "role" | "active" | "createdAt" | "updatedAt"
>;

export type UserListResult = {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateUserInput = {
  name: string;
  email: string;
  role: AllowedApplicationRole;
  active: boolean;
  password: string;
  passwordConfirmation: string;
};

export type UpdateUserInput = {
  name?: string;
  role?: AllowedApplicationRole;
  active?: boolean;
};

export class UserManagementError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "UserManagementError";
    this.code = code;
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type JsonObject = Record<string, Prisma.InputJsonValue>;

function isAllowedRole(role: string): role is AllowedApplicationRole {
  return isApplicationRole(role);
}

function toPositiveInt(value: number | undefined, fallback: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

async function findSupabaseAuthUserByEmail(email: string) {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new UserManagementError(
        "AUTH_LOOKUP_FAILED",
        "Unable to check existing authentication accounts.",
        500,
      );
    }

    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );

    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export async function listManagedUsers(
  prisma: Pick<PrismaClient, "user">,
  filters: UserListFilters,
): Promise<UserListResult> {
  const pageSize = Math.min(Math.max(toPositiveInt(filters.pageSize, 10), 1), 50);
  const page = Math.max(toPositiveInt(filters.page, 1), 1);
  const search = filters.query?.trim();
  const role = filters.role && isAllowedRole(filters.role) ? filters.role : undefined;
  const status = filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const orderBy = [{ [sortBy]: sortOrder } as Prisma.UserOrderByWithRelationInput];

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status === undefined ? {} : { active: status }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createManagedUser(
  prisma: Pick<PrismaClient, "user" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  input: CreateUserInput,
): Promise<{ user: User }> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) {
    throw new UserManagementError("INVALID_NAME", "Full name is required.");
  }

  if (!email) {
    throw new UserManagementError("INVALID_EMAIL", "Email is required.");
  }

  if (!isAllowedRole(input.role)) {
    throw new UserManagementError("INVALID_ROLE", "The selected role is not valid.");
  }

  if (input.password.length < 8) {
    throw new UserManagementError("INVALID_PASSWORD", "Password must be at least 8 characters.");
  }

  if (input.password !== input.passwordConfirmation) {
    throw new UserManagementError("PASSWORD_MISMATCH", "Passwords do not match.");
  }

  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (dbUser) {
    throw new UserManagementError(
      "EMAIL_EXISTS",
      "A user with this email already exists.",
      409,
    );
  }

  const authUser = await findSupabaseAuthUserByEmail(email);
  if (authUser) {
    throw new UserManagementError(
      "AUTH_EMAIL_EXISTS",
      "A user with this email already exists.",
      409,
    );
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: input.role,
    },
  });

  if (error || !data.user) {
    throw new UserManagementError(
      "AUTH_CREATE_FAILED",
      "The authentication account could not be created.",
      500,
    );
  }

  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        id: data.user.id,
        name,
        email,
        role: input.role,
        active: input.active,
      },
    });
  } catch (error) {
    console.error("Supabase Auth user created but PostgreSQL user creation failed", error);
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    throw new UserManagementError(
      "DATABASE_CREATE_FAILED",
      "Unable to create the application user.",
      500,
    );
  }

  // The user row is the source of truth for app access; audit logging should not
  // roll back a successfully created PostgreSQL/Supabase user pair.
  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action: "USER_CREATED" as ActivityAction,
      entityType: "User",
      entityId: user.id,
      description: `Created application user ${user.email}`,
      metadata: {
        role: user.role,
        active: user.active,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("User created but creation audit logging failed", error);
  }

  return { user };
}

export async function updateManagedUser(
  prisma: Pick<PrismaClient, "user" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  userId: string,
  input: UpdateUserInput,
): Promise<{ user: User }> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new UserManagementError("USER_NOT_FOUND", "User not found.", 404);
  }

  const updates: Prisma.UserUpdateInput = {};
  const metadata: JsonObject = {};
  const logs: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new UserManagementError("INVALID_NAME", "Full name is required.");
    }
    updates.name = name;
    metadata.name = name;
  }

  if (input.role !== undefined) {
    if (!isAllowedRole(input.role)) {
      throw new UserManagementError("INVALID_ROLE", "The selected role is not valid.");
    }
    if (input.role !== existing.role) {
      updates.role = input.role;
      logs.push({
        action: "USER_ROLE_CHANGED" as ActivityAction,
        description: `Changed role for ${existing.email} from ${existing.role} to ${input.role}`,
        metadata: { from: existing.role, to: input.role },
      });
    }
  }

  if (input.active !== undefined && input.active !== existing.active) {
    updates.active = input.active;
    logs.push({
      action: input.active
        ? ("USER_ACTIVATED" as ActivityAction)
        : ("USER_DEACTIVATED" as ActivityAction),
      description: `${input.active ? "Activated" : "Deactivated"} user ${existing.email}`,
      metadata: { active: input.active },
    });
  }

  if (Object.keys(updates).length === 0) {
    return { user: existing };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updates,
  });

  const logActions: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.name !== undefined && input.name.trim() !== existing.name) {
    logActions.push({
      action: "USER_UPDATED" as ActivityAction,
      description: `Updated user ${existing.email}`,
      metadata: { ...metadata, name: user.name },
    });
  }

  logActions.push(...logs);

  for (const log of logActions) {
    try {
      await createActivityLogIfSupported(prisma, {
        userId: actorUser.id,
        action: log.action,
        entityType: "User",
        entityId: user.id,
        description: log.description,
        metadata: log.metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      console.error("User updated but audit logging failed", error);
    }
  }

  return { user };
}

/**
 * Deactivation is a database-backed soft delete so historical audit and
 * monitoring relations remain intact. Authentication checks the same active
 * flag before allowing the user into the application.
 */
export async function deactivateManagedUser(
  prisma: Pick<PrismaClient, "user" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  userId: string,
) {
  const result = await updateManagedUser(prisma, actorUser, userId, { active: false });
  if (result.user.active) {
    throw new UserManagementError(
      "DEACTIVATION_NOT_PERSISTED",
      "The user deactivation was not persisted to the database.",
      500,
    );
  }
  return result;
}

export async function deleteManagedUser(
  prisma: Pick<PrismaClient, "user" | "activityLog" | "notification" | "$queryRaw" | "$transaction">,
  actorUser: { id: string; name: string },
  userId: string,
) {
  if (actorUser.id === userId) {
    throw new UserManagementError("CANNOT_DELETE_SELF", "You cannot delete your own account.", 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!existing) {
    throw new UserManagementError("USER_NOT_FOUND", "User not found.", 404);
  }

  const deletedUser = await prisma.$transaction(async (tx) => {
    await tx.activityLog.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { recipientUserId: userId } });
    const deleted = await tx.user.delete({ where: { id: userId } });
    return deleted;
  });

  // Audit logging must not make an already completed deletion appear to fail.
  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action: "USER_DEACTIVATED" as ActivityAction,
      entityType: "User",
      entityId: userId,
      description: `Permanently deleted user ${existing.email}`,
      metadata: { deleted: true, permanent: true } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("User deleted but permanent deletion audit logging failed", error);
  }

  return { user: deletedUser };
}

export function assertAllowedRole(role: string): asserts role is AllowedApplicationRole {
  if (!isAllowedRole(role)) {
    throw new UserManagementError("INVALID_ROLE", "The selected role is not valid.");
  }
}
