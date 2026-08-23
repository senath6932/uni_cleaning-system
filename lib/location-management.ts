import type { ActivityAction, Location, Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { createActivityLogIfSupported } from "@/lib/audit-logging";

export type LocationListFilters = {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "code" | "name" | "minimumWorkers" | "active" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type LocationListItem = Pick<
  Location,
  "id" | "code" | "name" | "minimumWorkers" | "active" | "createdAt" | "updatedAt"
>;

export type LocationListResult = {
  locations: LocationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateLocationInput = {
  code: string;
  name: string;
  minimumWorkers?: unknown;
  active?: boolean;
};

export type UpdateLocationInput = {
  code?: string;
  name?: string;
  minimumWorkers?: unknown;
  active?: boolean;
};

export class LocationManagementError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "LocationManagementError";
    this.code = code;
    this.status = status;
  }
}

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

function normalizeText(value: string) {
  return value.trim();
}

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

function parseMinimumWorkers(
  value: unknown,
  mode: "create" | "update",
): number | null | undefined {
  if (value === undefined) {
    return mode === "create" ? null : undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new LocationManagementError(
        "INVALID_MINIMUM_WORKERS",
        "Minimum workers must be a whole number greater than or equal to zero.",
      );
    }

    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (!/^\d+$/.test(trimmed)) {
      throw new LocationManagementError(
        "INVALID_MINIMUM_WORKERS",
        "Minimum workers must be a whole number greater than or equal to zero.",
      );
    }

    return Number(trimmed);
  }

  throw new LocationManagementError(
    "INVALID_MINIMUM_WORKERS",
    "Minimum workers must be a whole number greater than or equal to zero.",
  );
}

function buildLocationSelect() {
  return {
    id: true,
    code: true,
    name: true,
    minimumWorkers: true,
    active: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.LocationSelect;
}

async function ensureLocationCodeAvailable(
  prisma: Pick<PrismaClient, "location">,
  code: string,
  currentLocationId?: string,
) {
  const existing = await prisma.location.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existing && existing.id !== currentLocationId) {
    throw new LocationManagementError(
      "LOCATION_CODE_EXISTS",
      "A location with this code already exists.",
      409,
    );
  }
}

function baseWhere(filters: LocationListFilters): Prisma.LocationWhereInput {
  const search = filters.query?.trim();
  const status =
    filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;

  return {
    ...(status === undefined ? {} : { active: status }),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function pickOrderBy(sortBy: NonNullable<LocationListFilters["sortBy"]>, sortOrder: "asc" | "desc") {
  return [{ [sortBy]: sortOrder } as Prisma.LocationOrderByWithRelationInput];
}

function mapLocation(location: Location): LocationListItem {
  return {
    id: location.id,
    code: location.code,
    name: location.name,
    minimumWorkers: location.minimumWorkers,
    active: location.active,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}

export async function listManagedLocations(
  prisma: Pick<PrismaClient, "location">,
  filters: LocationListFilters,
): Promise<LocationListResult> {
  const pageSize = Math.min(Math.max(toPositiveInt(filters.pageSize, 10), 1), 50);
  const page = Math.max(toPositiveInt(filters.page, 1), 1);
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const where = baseWhere(filters);

  const [total, locations] = await Promise.all([
    prisma.location.count({ where }),
    prisma.location.findMany({
      where,
      orderBy: pickOrderBy(sortBy, sortOrder),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: buildLocationSelect(),
    }),
  ]);

  return {
    locations: locations.map(mapLocation),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getManagedLocationById(
  prisma: Pick<PrismaClient, "location">,
  locationId: string,
): Promise<LocationListItem | null> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: buildLocationSelect(),
  });

  return location ? mapLocation(location) : null;
}

export async function createManagedLocation(
  prisma: Pick<PrismaClient, "location" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  input: CreateLocationInput,
): Promise<{ location: LocationListItem }> {
  const code = normalizeText(input.code);
  const name = normalizeText(input.name);
  const minimumWorkers = parseMinimumWorkers(input.minimumWorkers, "create");
  const active = input.active ?? true;

  if (!code) {
    throw new LocationManagementError("INVALID_CODE", "Location code is required.");
  }

  if (!name) {
    throw new LocationManagementError("INVALID_NAME", "Location name is required.");
  }

  await ensureLocationCodeAvailable(prisma, code);

  let location: Location;
  try {
    location = await prisma.location.create({
      data: {
        code,
        name,
        minimumWorkers,
        active,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new LocationManagementError(
        "LOCATION_CODE_EXISTS",
        "A location with this code already exists.",
        409,
      );
    }

    throw new LocationManagementError(
      "DATABASE_CREATE_FAILED",
      "Unable to create the location.",
      500,
    );
  }

  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action: "LOCATION_CREATED" as ActivityAction,
      entityType: "Location",
      entityId: location.id,
      description: `Created location ${location.code}`,
      metadata: {
        code: location.code,
        name: location.name,
        minimumWorkers: location.minimumWorkers,
        active: location.active,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("Location created but audit logging failed", error);
  }

  return { location: mapLocation(location) };
}

export async function updateManagedLocation(
  prisma: Pick<PrismaClient, "location" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  locationId: string,
  input: UpdateLocationInput,
): Promise<{ location: LocationListItem }> {
  const existing = await prisma.location.findUnique({
    where: { id: locationId },
    select: buildLocationSelect(),
  });

  if (!existing) {
    throw new LocationManagementError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  const updates: Prisma.LocationUpdateInput = {};
  const logs: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.code !== undefined) {
    const code = normalizeText(input.code);
    if (!code) {
      throw new LocationManagementError("INVALID_CODE", "Location code is required.");
    }

    if (code !== existing.code) {
      await ensureLocationCodeAvailable(prisma, code, existing.id);
      updates.code = code;
      logs.push({
        action: "LOCATION_UPDATED" as ActivityAction,
        description: `Updated location code for ${existing.code}`,
        metadata: { from: existing.code, to: code },
      });
    }
  }

  if (input.name !== undefined) {
    const name = normalizeText(input.name);
    if (!name) {
      throw new LocationManagementError("INVALID_NAME", "Location name is required.");
    }

    if (name !== existing.name) {
      updates.name = name;
      logs.push({
        action: "LOCATION_UPDATED" as ActivityAction,
        description: `Updated location ${existing.code}`,
        metadata: { name },
      });
    }
  }

  if (input.minimumWorkers !== undefined) {
    const minimumWorkers = parseMinimumWorkers(input.minimumWorkers, "update");
    if (minimumWorkers !== undefined && minimumWorkers !== existing.minimumWorkers) {
      updates.minimumWorkers = minimumWorkers;
      logs.push({
        action: "LOCATION_UPDATED" as ActivityAction,
        description: `Updated minimum workers for ${existing.code}`,
        metadata: { minimumWorkers: minimumWorkers as number | null },
      });
    }
  }

  if (input.active !== undefined && input.active !== existing.active) {
    updates.active = input.active;
    logs.push({
      action: input.active
        ? ("LOCATION_ACTIVATED" as ActivityAction)
        : ("LOCATION_DEACTIVATED" as ActivityAction),
      description: `${input.active ? "Activated" : "Deactivated"} location ${existing.code}`,
      metadata: { active: input.active },
    });
  }

  if (Object.keys(updates).length === 0) {
    return { location: existing };
  }

  let location: Location;
  try {
    location = await prisma.location.update({
      where: { id: locationId },
      data: updates,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new LocationManagementError(
        "LOCATION_CODE_EXISTS",
        "A location with this code already exists.",
        409,
      );
    }

    throw new LocationManagementError(
      "DATABASE_UPDATE_FAILED",
      "Unable to update the location.",
      500,
    );
  }

  for (const log of logs) {
    try {
      await createActivityLogIfSupported(prisma, {
        userId: actorUser.id,
        action: log.action,
        entityType: "Location",
        entityId: location.id,
        description: log.description,
        metadata: log.metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      console.error("Location updated but audit logging failed", error);
    }
  }

  return { location: mapLocation(location) };
}

export async function activateManagedLocation(
  prisma: Pick<PrismaClient, "location" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  locationId: string,
) {
  return updateManagedLocation(prisma, actorUser, locationId, { active: true });
}

export async function deactivateManagedLocation(
  prisma: Pick<PrismaClient, "location" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  locationId: string,
) {
  return updateManagedLocation(prisma, actorUser, locationId, { active: false });
}

export async function deleteManagedLocation(
  prisma: Pick<
    PrismaClient,
    | "location"
    | "locationTask"
    | "workerLocationAssignment"
    | "evaluatingOfficerAssignment"
    | "pHIAssignment"
    | "dailyCleaningEvaluation"
    | "workerAttendance"
    | "dailyAttendanceEvaluation"
    | "monthlyEvaluationReport"
    | "additionalCleaningTask"
    | "activityLog"
    | "$transaction"
    | "$queryRaw"
  >,
  actorUser: { id: string; name: string },
  locationId: string,
) {
  const existing = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  if (!existing) {
    throw new LocationManagementError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  const dependencyCounts = await Promise.all([
    prisma.locationTask.count({ where: { locationId } }),
    prisma.workerLocationAssignment.count({ where: { locationId } }),
    prisma.evaluatingOfficerAssignment.count({ where: { locationId } }),
    prisma.pHIAssignment.count({ where: { locationId } }),
    prisma.dailyCleaningEvaluation.count({ where: { locationId } }),
    prisma.workerAttendance.count({ where: { locationId } }),
    prisma.dailyAttendanceEvaluation.count({ where: { locationId } }),
    prisma.monthlyEvaluationReport.count({ where: { locationId } }),
    prisma.additionalCleaningTask.count({ where: { locationId } }),
  ]);

  if (dependencyCounts.some((count) => count > 0)) {
    throw new LocationManagementError(
      "LOCATION_IN_USE",
      "This location is still linked to other records and cannot be permanently deleted. Remove or reassign those records first.",
      409,
    );
  }

  let deletedLocation: Location;
  try {
    deletedLocation = await prisma.location.delete({
      where: { id: locationId },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "P2003") {
        throw new LocationManagementError(
          "LOCATION_IN_USE",
          "This location is still linked to other records and cannot be permanently deleted. Remove or reassign those records first.",
          409,
        );
      }

      if (code === "P2025") {
        throw new LocationManagementError("LOCATION_NOT_FOUND", "Location not found.", 404);
      }
    }

    throw new LocationManagementError(
      "DATABASE_DELETE_FAILED",
      "Unable to delete the location.",
      500,
    );
  }

  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action: "LOCATION_DEACTIVATED" as ActivityAction,
      entityType: "Location",
      entityId: deletedLocation.id,
      description: `Permanently deleted location ${existing.code}`,
      metadata: {
        code: existing.code,
        name: existing.name,
        deleted: true,
        permanent: true,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("Location deleted but audit logging failed", error);
  }

  return { location: mapLocation(deletedLocation) };
}
