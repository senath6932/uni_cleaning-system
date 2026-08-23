import type {
  ActivityAction,
  Location,
  Prisma,
  PrismaClient,
  User,
  UserRole,
} from "@/app/generated/prisma/client";

export type PHIAssignmentListFilters = {
  query?: string;
  phiId?: string;
  locationId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "active";
  sortOrder?: "asc" | "desc";
};

export type PHIAssignmentListItem = {
  id: string;
  userId: string;
  locationId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: Pick<User, "id" | "name" | "email" | "role" | "active">;
  location: Pick<Location, "id" | "code" | "name" | "active">;
};

export type PHIAssignmentListResult = {
  assignments: PHIAssignmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PHIReferenceData = {
  phis: Pick<User, "id" | "name" | "email" | "role" | "active">[];
  locations: Pick<Location, "id" | "code" | "name" | "active">[];
  activePhis: Pick<User, "id" | "name" | "email" | "role" | "active">[];
  activeLocations: Pick<Location, "id" | "code" | "name" | "active">[];
};

export type CreatePHIAssignmentInput = {
  userId: string;
  locationId: string;
  active?: boolean;
};

export type UpdatePHIAssignmentInput = {
  active?: boolean;
};

export class PHIAssignmentError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PHIAssignmentError";
    this.code = code;
    this.status = status;
  }
}

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

const phiSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} satisfies Prisma.UserSelect;

const locationSelect = {
  id: true,
  code: true,
  name: true,
  active: true,
} satisfies Prisma.LocationSelect;

const assignmentSelect = {
  id: true,
  userId: true,
  locationId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: phiSelect,
  },
  location: {
    select: locationSelect,
  },
} satisfies Prisma.PHIAssignmentSelect;

type AssignmentRecord = Prisma.PHIAssignmentGetPayload<{
  select: typeof assignmentSelect;
}>;

function toPositiveInt(value: number | undefined, fallback: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function normalizeText(value: string) {
  return value.trim();
}

function isPhiRole(role: string): role is UserRole {
  return role === "PHI";
}

function buildAssignmentSelect() {
  return assignmentSelect;
}

function mapAssignment(assignment: AssignmentRecord): PHIAssignmentListItem {
  return {
    id: assignment.id,
    userId: assignment.userId,
    locationId: assignment.locationId,
    active: assignment.active,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    user: assignment.user,
    location: assignment.location,
  };
}

function buildWhere(filters: PHIAssignmentListFilters): Prisma.PHIAssignmentWhereInput {
  const search = filters.query?.trim();
  const status =
    filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;

  return {
    ...(filters.phiId ? { userId: filters.phiId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(status === undefined ? {} : { active: status }),
    ...(search
      ? {
          OR: [
            {
              user: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              },
            },
            {
              location: {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };
}

function buildOrderBy(
  sortBy: NonNullable<PHIAssignmentListFilters["sortBy"]>,
  sortOrder: "asc" | "desc",
) {
  return [{ [sortBy]: sortOrder } as Prisma.PHIAssignmentOrderByWithRelationInput];
}

async function loadPhiAndLocation(
  prisma: Pick<PrismaClient, "user" | "location">,
  userId: string,
  locationId: string,
) {
  const [phi, location] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: phiSelect,
    }),
    prisma.location.findUnique({
      where: { id: locationId },
      select: locationSelect,
    }),
  ]);

  if (!phi) {
    throw new PHIAssignmentError("PHI_NOT_FOUND", "PHI not found.", 404);
  }

  if (!isPhiRole(phi.role)) {
    throw new PHIAssignmentError("INVALID_PHI_ROLE", "The selected user is not a PHI.");
  }

  if (!phi.active) {
    throw new PHIAssignmentError("PHI_INACTIVE", "Inactive users cannot be assigned as PHI.", 400);
  }

  if (!location) {
    throw new PHIAssignmentError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  if (!location.active) {
    throw new PHIAssignmentError(
      "LOCATION_INACTIVE",
      "Inactive locations cannot be assigned to PHI users.",
      400,
    );
  }

  return { phi, location };
}

async function findExistingAssignment(
  prisma: Pick<PrismaClient, "pHIAssignment">,
  userId: string,
  locationId: string,
) {
  return prisma.pHIAssignment.findFirst({
    where: { userId, locationId },
    select: buildAssignmentSelect(),
  });
}

function descriptionFor(phiName: string, locationCode: string) {
  return `${phiName} -> ${locationCode}`;
}

export async function listManagedPHIAssignments(
  prisma: Pick<PrismaClient, "pHIAssignment">,
  filters: PHIAssignmentListFilters,
): Promise<PHIAssignmentListResult> {
  const pageSize = Math.min(Math.max(toPositiveInt(filters.pageSize, 10), 1), 50);
  const page = Math.max(toPositiveInt(filters.page, 1), 1);
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const where = buildWhere(filters);

  const [total, assignments] = await Promise.all([
    prisma.pHIAssignment.count({ where }),
    prisma.pHIAssignment.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortOrder),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: buildAssignmentSelect(),
    }),
  ]);

  return {
    assignments: assignments.map(mapAssignment),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getManagedPHIAssignmentById(
  prisma: Pick<PrismaClient, "pHIAssignment">,
  assignmentId: string,
): Promise<PHIAssignmentListItem | null> {
  const assignment = await prisma.pHIAssignment.findUnique({
    where: { id: assignmentId },
    select: buildAssignmentSelect(),
  });

  return assignment ? mapAssignment(assignment) : null;
}

export async function listPHIReferenceData(
  prisma: Pick<PrismaClient, "user" | "location">,
): Promise<PHIReferenceData> {
  const [phis, locations, activePhis, activeLocations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PHI" },
      select: phiSelect,
      orderBy: [{ name: "asc" }],
    }),
    prisma.location.findMany({
      select: locationSelect,
      orderBy: [{ code: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "PHI", active: true },
      select: phiSelect,
      orderBy: [{ name: "asc" }],
    }),
    prisma.location.findMany({
      where: { active: true },
      select: locationSelect,
      orderBy: [{ code: "asc" }],
    }),
  ]);

  return { phis, locations, activePhis, activeLocations };
}

export async function createManagedPHIAssignment(
  prisma: Pick<PrismaClient, "user" | "location" | "pHIAssignment" | "activityLog" | "$transaction">,
  actorUser: { id: string; name: string },
  input: CreatePHIAssignmentInput,
): Promise<{ assignment: PHIAssignmentListItem; operation: "created" | "reactivated" | "existing" }> {
  const userId = normalizeText(input.userId);
  const locationId = normalizeText(input.locationId);

  if (!userId) {
    throw new PHIAssignmentError("INVALID_PHI", "PHI is required.");
  }

  if (!locationId) {
    throw new PHIAssignmentError("INVALID_LOCATION", "Location is required.");
  }

  const { phi, location } = await loadPhiAndLocation(prisma, userId, locationId);
  const existing = await findExistingAssignment(prisma, userId, locationId);

  if (existing?.active) {
    throw new PHIAssignmentError(
      "ASSIGNMENT_EXISTS",
      "This PHI is already assigned to the selected location.",
      409,
    );
  }

  if (existing && input.active === false) {
    return { assignment: mapAssignment(existing), operation: "existing" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (existing) {
        const updated = await tx.pHIAssignment.update({
          where: { id: existing.id },
          data: { active: true },
          select: buildAssignmentSelect(),
        });

        await tx.activityLog.create({
          data: {
            userId: actorUser.id,
            action: "PHI_ASSIGNMENT_ACTIVATED" as ActivityAction,
            entityType: "PHIAssignment",
            entityId: updated.id,
            description: `Reactivated assignment ${descriptionFor(phi.name, location.code)}`,
            metadata: {
              phiId: phi.id,
              locationId: location.id,
            } as Prisma.InputJsonValue,
          },
        });

        return { assignment: updated, operation: "reactivated" as const };
      }

      const created = await tx.pHIAssignment.create({
        data: {
          userId,
          locationId,
          active: input.active ?? true,
        },
        select: buildAssignmentSelect(),
      });

      await tx.activityLog.create({
        data: {
          userId: actorUser.id,
          action: "PHI_ASSIGNED" as ActivityAction,
          entityType: "PHIAssignment",
          entityId: created.id,
          description: `Assigned ${phi.name} to ${location.code}`,
          metadata: {
            phiId: phi.id,
            locationId: location.id,
          } as Prisma.InputJsonValue,
        },
      });

      return { assignment: created, operation: "created" as const };
    });

    return { assignment: mapAssignment(result.assignment), operation: result.operation };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PHIAssignmentError(
        "ASSIGNMENT_EXISTS",
        "This PHI is already assigned to the selected location.",
        409,
      );
    }

    throw new PHIAssignmentError("DATABASE_CREATE_FAILED", "Unable to create the assignment.", 500);
  }
}

export async function updateManagedPHIAssignment(
  prisma: Pick<PrismaClient, "pHIAssignment" | "activityLog" | "$transaction">,
  actorUser: { id: string; name: string },
  assignmentId: string,
  input: UpdatePHIAssignmentInput,
): Promise<{ assignment: PHIAssignmentListItem }> {
  const existing = await prisma.pHIAssignment.findUnique({
    where: { id: assignmentId },
    select: buildAssignmentSelect(),
  });

  if (!existing) {
    throw new PHIAssignmentError("ASSIGNMENT_NOT_FOUND", "Assignment not found.", 404);
  }

  const updates: Prisma.PHIAssignmentUpdateInput = {};
  const logs: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.active !== undefined && input.active !== existing.active) {
    updates.active = input.active;
    logs.push({
      action: input.active
        ? ("PHI_ASSIGNMENT_ACTIVATED" as ActivityAction)
        : ("PHI_ASSIGNMENT_DEACTIVATED" as ActivityAction),
      description: `${input.active ? "Activated" : "Deactivated"} assignment ${descriptionFor(
        existing.user.name,
        existing.location.code,
      )}`,
      metadata: {
        phiId: existing.userId,
        locationId: existing.locationId,
        active: input.active,
      },
    });
  }

  if (Object.keys(updates).length === 0) {
    return { assignment: existing };
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const updated = await tx.pHIAssignment.update({
        where: { id: assignmentId },
        data: updates,
        select: buildAssignmentSelect(),
      });

      for (const log of logs) {
        await tx.activityLog.create({
          data: {
            userId: actorUser.id,
            action: log.action,
            entityType: "PHIAssignment",
            entityId: updated.id,
            description: log.description,
            metadata: log.metadata as Prisma.InputJsonValue,
          },
        });
      }

      return updated;
    });

    return { assignment: mapAssignment(assignment) };
  } catch {
    throw new PHIAssignmentError("DATABASE_UPDATE_FAILED", "Unable to update the assignment.", 500);
  }
}

export async function activateManagedPHIAssignment(
  prisma: Pick<PrismaClient, "pHIAssignment" | "activityLog" | "$transaction">,
  actorUser: { id: string; name: string },
  assignmentId: string,
) {
  return updateManagedPHIAssignment(prisma, actorUser, assignmentId, { active: true });
}

export async function deactivateManagedPHIAssignment(
  prisma: Pick<PrismaClient, "pHIAssignment" | "activityLog" | "$transaction">,
  actorUser: { id: string; name: string },
  assignmentId: string,
) {
  return updateManagedPHIAssignment(prisma, actorUser, assignmentId, { active: false });
}

export async function canPhiAccessLocation(
  prisma: Pick<PrismaClient, "pHIAssignment">,
  userId: string,
  locationId: string,
) {
  const assignment = await prisma.pHIAssignment.findFirst({
    where: { userId, locationId, active: true },
    select: { id: true },
  });

  return Boolean(assignment);
}
