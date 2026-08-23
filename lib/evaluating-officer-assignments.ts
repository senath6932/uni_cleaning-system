import type {
  ActivityAction,
  Location,
  Prisma,
  PrismaClient,
  User,
  UserRole,
} from "@/app/generated/prisma/client";
import { createActivityLogIfSupported } from "@/lib/audit-logging";

export type EvaluatingOfficerAssignmentListFilters = {
  query?: string;
  officerId?: string;
  locationId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "active";
  sortOrder?: "asc" | "desc";
};

export type EvaluatingOfficerAssignmentListItem = {
  id: string;
  userId: string;
  locationId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: Pick<User, "id" | "name" | "email" | "role" | "active">;
  location: Pick<Location, "id" | "code" | "name" | "active">;
};

export type EvaluatingOfficerAssignmentListResult = {
  assignments: EvaluatingOfficerAssignmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type EvaluatingOfficerReferenceData = {
  officers: Pick<User, "id" | "name" | "email" | "role" | "active">[];
  locations: Pick<Location, "id" | "code" | "name" | "active">[];
  activeOfficers: Pick<User, "id" | "name" | "email" | "role" | "active">[];
  activeLocations: Pick<Location, "id" | "code" | "name" | "active">[];
};

export type CreateEvaluatingOfficerAssignmentInput = {
  userId: string;
  locationId: string;
  active?: boolean;
};

export type UpdateEvaluatingOfficerAssignmentInput = {
  active?: boolean;
};

export class EvaluatingOfficerAssignmentError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "EvaluatingOfficerAssignmentError";
    this.code = code;
    this.status = status;
  }
}

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

const officerSelect = {
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
    select: officerSelect,
  },
  location: {
    select: locationSelect,
  },
} satisfies Prisma.EvaluatingOfficerAssignmentSelect;

type AssignmentRecord = Prisma.EvaluatingOfficerAssignmentGetPayload<{
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

function isEvaluatingOfficerRole(role: string): role is UserRole {
  return role === "EVALUATING_OFFICER";
}

function buildAssignmentSelect() {
  return assignmentSelect;
}

function mapAssignment(assignment: AssignmentRecord): EvaluatingOfficerAssignmentListItem {
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

function buildWhere(filters: EvaluatingOfficerAssignmentListFilters): Prisma.EvaluatingOfficerAssignmentWhereInput {
  const search = filters.query?.trim();
  const status =
    filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;

  return {
    ...(filters.officerId ? { userId: filters.officerId } : {}),
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
  sortBy: NonNullable<EvaluatingOfficerAssignmentListFilters["sortBy"]>,
  sortOrder: "asc" | "desc",
) {
  return [{ [sortBy]: sortOrder } as Prisma.EvaluatingOfficerAssignmentOrderByWithRelationInput];
}

async function loadOfficerAndLocation(
  prisma: Pick<PrismaClient, "user" | "location">,
  userId: string,
  locationId: string,
) {
  const [officer, location] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: officerSelect,
    }),
    prisma.location.findUnique({
      where: { id: locationId },
      select: locationSelect,
    }),
  ]);

  if (!officer) {
    throw new EvaluatingOfficerAssignmentError("OFFICER_NOT_FOUND", "Officer not found.", 404);
  }

  if (!isEvaluatingOfficerRole(officer.role)) {
    throw new EvaluatingOfficerAssignmentError(
      "INVALID_OFFICER_ROLE",
      "The selected user is not an Evaluating Officer.",
    );
  }

  if (!officer.active) {
    throw new EvaluatingOfficerAssignmentError(
      "OFFICER_INACTIVE",
      "Inactive users cannot be assigned as Evaluating Officers.",
      400,
    );
  }

  if (!location) {
    throw new EvaluatingOfficerAssignmentError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  if (!location.active) {
    throw new EvaluatingOfficerAssignmentError(
      "LOCATION_INACTIVE",
      "Inactive locations cannot be assigned to Evaluating Officers.",
      400,
    );
  }

  return { officer, location };
}

async function ensureAssignmentDoesNotExist(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment">,
  userId: string,
  locationId: string,
) {
  const existing = await prisma.evaluatingOfficerAssignment.findFirst({
    where: { userId, locationId },
    select: buildAssignmentSelect(),
  });

  return existing;
}

function descriptionFor(officerName: string, locationCode: string) {
  return `${officerName} -> ${locationCode}`;
}

export async function listManagedEvaluatingOfficerAssignments(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment">,
  filters: EvaluatingOfficerAssignmentListFilters,
): Promise<EvaluatingOfficerAssignmentListResult> {
  const pageSize = Math.min(Math.max(toPositiveInt(filters.pageSize, 10), 1), 50);
  const page = Math.max(toPositiveInt(filters.page, 1), 1);
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const where = buildWhere(filters);

  const [total, assignments] = await Promise.all([
    prisma.evaluatingOfficerAssignment.count({ where }),
    prisma.evaluatingOfficerAssignment.findMany({
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

export async function getManagedEvaluatingOfficerAssignmentById(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment">,
  assignmentId: string,
): Promise<EvaluatingOfficerAssignmentListItem | null> {
  const assignment = await prisma.evaluatingOfficerAssignment.findUnique({
    where: { id: assignmentId },
    select: buildAssignmentSelect(),
  });

  return assignment ? mapAssignment(assignment) : null;
}

export async function listEvaluatingOfficerReferenceData(
  prisma: Pick<PrismaClient, "user" | "location">,
): Promise<EvaluatingOfficerReferenceData> {
  const [officers, locations, activeOfficers, activeLocations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "EVALUATING_OFFICER" },
      select: officerSelect,
      orderBy: [{ name: "asc" }],
    }),
    prisma.location.findMany({
      select: locationSelect,
      orderBy: [{ code: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "EVALUATING_OFFICER", active: true },
      select: officerSelect,
      orderBy: [{ name: "asc" }],
    }),
    prisma.location.findMany({
      where: { active: true },
      select: locationSelect,
      orderBy: [{ code: "asc" }],
    }),
  ]);

  return { officers, locations, activeOfficers, activeLocations };
}

export async function createManagedEvaluatingOfficerAssignment(
  prisma: Pick<
    PrismaClient,
    "user" | "location" | "evaluatingOfficerAssignment" | "activityLog" | "$queryRaw"
  >,
  actorUser: { id: string; name: string },
  input: CreateEvaluatingOfficerAssignmentInput,
): Promise<{
  assignment: EvaluatingOfficerAssignmentListItem;
  operation: "created" | "reactivated" | "existing";
}> {
  const userId = normalizeText(input.userId);
  const locationId = normalizeText(input.locationId);

  if (!userId) {
    throw new EvaluatingOfficerAssignmentError("INVALID_OFFICER", "Officer is required.");
  }

  if (!locationId) {
    throw new EvaluatingOfficerAssignmentError("INVALID_LOCATION", "Location is required.");
  }

  const { officer, location } = await loadOfficerAndLocation(prisma, userId, locationId);
  const existing = await ensureAssignmentDoesNotExist(prisma, userId, locationId);

  if (existing?.active) {
    throw new EvaluatingOfficerAssignmentError(
      "ASSIGNMENT_EXISTS",
      "This Evaluating Officer is already assigned to the selected location.",
      409,
    );
  }

  if (existing && input.active === false) {
    return { assignment: mapAssignment(existing), operation: "existing" };
  }

  let result: { assignment: AssignmentRecord; operation: "created" | "reactivated" };
  try {
    if (existing) {
      const updated = await prisma.evaluatingOfficerAssignment.update({
        where: { id: existing.id },
        data: { active: true },
        select: buildAssignmentSelect(),
      });

      result = { assignment: updated, operation: "reactivated" };
    } else {
      const created = await prisma.evaluatingOfficerAssignment.create({
        data: {
          userId,
          locationId,
          active: input.active ?? true,
        },
        select: buildAssignmentSelect(),
      });

      result = { assignment: created, operation: "created" };
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EvaluatingOfficerAssignmentError(
        "ASSIGNMENT_EXISTS",
        "This Evaluating Officer is already assigned to the selected location.",
        409,
      );
    }

    throw new EvaluatingOfficerAssignmentError(
      "DATABASE_CREATE_FAILED",
      "Unable to create the assignment.",
      500,
    );
  }

  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action:
        result.operation === "reactivated"
          ? ("EVALUATING_OFFICER_ASSIGNMENT_ACTIVATED" as ActivityAction)
          : ("EVALUATING_OFFICER_ASSIGNED" as ActivityAction),
      entityType: "EvaluatingOfficerAssignment",
      entityId: result.assignment.id,
      description:
        result.operation === "reactivated"
          ? `Reactivated assignment ${descriptionFor(officer.name, location.code)}`
          : `Assigned ${officer.name} to ${location.code}`,
      metadata: {
        officerId: officer.id,
        locationId: location.id,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("Evaluating Officer assignment changed but audit logging failed", error);
  }

  return { assignment: mapAssignment(result.assignment), operation: result.operation };
}

export async function updateManagedEvaluatingOfficerAssignment(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  assignmentId: string,
  input: UpdateEvaluatingOfficerAssignmentInput,
): Promise<{ assignment: EvaluatingOfficerAssignmentListItem }> {
  const existing = await prisma.evaluatingOfficerAssignment.findUnique({
    where: { id: assignmentId },
    select: buildAssignmentSelect(),
  });

  if (!existing) {
    throw new EvaluatingOfficerAssignmentError(
      "ASSIGNMENT_NOT_FOUND",
      "Assignment not found.",
      404,
    );
  }

  const updates: Prisma.EvaluatingOfficerAssignmentUpdateInput = {};
  const logs: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.active !== undefined && input.active !== existing.active) {
    updates.active = input.active;
    logs.push({
      action: input.active
        ? ("EVALUATING_OFFICER_ASSIGNMENT_ACTIVATED" as ActivityAction)
        : ("EVALUATING_OFFICER_ASSIGNMENT_DEACTIVATED" as ActivityAction),
      description: `${input.active ? "Activated" : "Deactivated"} assignment ${descriptionFor(
        existing.user.name,
        existing.location.code,
      )}`,
      metadata: {
        officerId: existing.userId,
        locationId: existing.locationId,
        active: input.active,
      },
    });
  }

  if (Object.keys(updates).length === 0) {
    return { assignment: existing };
  }

  let assignment: AssignmentRecord;
  try {
    assignment = await prisma.evaluatingOfficerAssignment.update({
      where: { id: assignmentId },
      data: updates,
      select: buildAssignmentSelect(),
    });
  } catch {
    throw new EvaluatingOfficerAssignmentError(
      "DATABASE_UPDATE_FAILED",
      "Unable to update the assignment.",
      500,
    );
  }

  for (const log of logs) {
    try {
      await createActivityLogIfSupported(prisma, {
        userId: actorUser.id,
        action: log.action,
        entityType: "EvaluatingOfficerAssignment",
        entityId: assignment.id,
        description: log.description,
        metadata: log.metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      console.error("Evaluating Officer assignment updated but audit logging failed", error);
    }
  }

  return { assignment: mapAssignment(assignment) };
}

export async function activateManagedEvaluatingOfficerAssignment(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  assignmentId: string,
) {
  return updateManagedEvaluatingOfficerAssignment(prisma, actorUser, assignmentId, { active: true });
}

export async function deactivateManagedEvaluatingOfficerAssignment(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  assignmentId: string,
) {
  return updateManagedEvaluatingOfficerAssignment(prisma, actorUser, assignmentId, { active: false });
}

export async function canEvaluatingOfficerAccessLocation(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment">,
  userId: string,
  locationId: string,
) {
  const assignment = await prisma.evaluatingOfficerAssignment.findFirst({
    where: { userId, locationId, active: true },
    select: { id: true },
  });

  return Boolean(assignment);
}
