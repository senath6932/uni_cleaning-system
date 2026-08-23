import {
  ActivityAction,
  CleaningTask,
  Location,
  Prisma,
  PrismaClient,
  TaskFrequency,
} from "@/app/generated/prisma/client";
import { createActivityLogIfSupported } from "@/lib/audit-logging";

export type LocationTaskListFilters = {
  query?: string;
  locationId?: string;
  taskId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "allocatedAmount" | "active";
  sortOrder?: "asc" | "desc";
};

const locationSelect = {
  id: true,
  code: true,
  name: true,
  active: true,
} satisfies Prisma.LocationSelect;

const taskSelect = {
  id: true,
  name: true,
  frequency: true,
  active: true,
} satisfies Prisma.CleaningTaskSelect;

const locationTaskSelect = {
  id: true,
  locationId: true,
  taskId: true,
  frequency: true,
  allocatedAmount: true,
  active: true,
  isAdditional: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: locationSelect,
  },
  task: {
    select: taskSelect,
  },
} satisfies Prisma.LocationTaskSelect;

type LocationTaskRecord = Prisma.LocationTaskGetPayload<{
  select: typeof locationTaskSelect;
}>;

export type LocationTaskListItem = {
  id: string;
  locationId: string;
  taskId: string;
  frequency: TaskFrequency;
  allocatedAmount: string;
  active: boolean;
  isAdditional: boolean;
  createdAt: Date;
  updatedAt: Date;
  location: Pick<Location, "id" | "code" | "name" | "active">;
  task: Pick<CleaningTask, "id" | "name" | "frequency" | "active">;
};

export type LocationTaskListResult = {
  locationTasks: LocationTaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LocationTaskReferenceData = {
  locations: Pick<Location, "id" | "code" | "name" | "active">[];
  tasks: Pick<CleaningTask, "id" | "name" | "frequency" | "active">[];
};

export type CreateLocationTaskInput = {
  locationId: string;
  taskId: string;
  allocatedAmount: unknown;
  active?: boolean;
  frequency?: string;
  isAdditional?: boolean;
};

export type UpdateLocationTaskInput = {
  allocatedAmount?: unknown;
  active?: boolean;
};

export class LocationTaskManagementError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "LocationTaskManagementError";
    this.code = code;
    this.status = status;
  }
}

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

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

function parseAllocatedAmount(value: unknown): Prisma.Decimal {
  if (value === undefined || value === null) {
    throw new LocationTaskManagementError(
      "INVALID_ALLOCATED_AMOUNT",
      "Allocated amount is required.",
    );
  }

  const text = typeof value === "string" ? value.trim() : String(value);

  if (!text) {
    throw new LocationTaskManagementError(
      "INVALID_ALLOCATED_AMOUNT",
      "Allocated amount is required.",
    );
  }

  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(text)) {
    throw new LocationTaskManagementError(
      "INVALID_ALLOCATED_AMOUNT",
      "Allocated amount must be a non-negative amount with up to two decimal places.",
    );
  }

  const amount = new Prisma.Decimal(text);

  if (amount.isNegative()) {
    throw new LocationTaskManagementError(
      "INVALID_ALLOCATED_AMOUNT",
      "Allocated amount must be greater than or equal to zero.",
    );
  }

  return amount;
}

function buildLocationTaskSelect() {
  return locationTaskSelect;
}

function mapLocationTask(locationTask: LocationTaskRecord): LocationTaskListItem {
  return {
    id: locationTask.id,
    locationId: locationTask.locationId,
    taskId: locationTask.taskId,
    frequency: locationTask.frequency,
    allocatedAmount: locationTask.allocatedAmount.toString(),
    active: locationTask.active,
    isAdditional: locationTask.isAdditional,
    createdAt: locationTask.createdAt,
    updatedAt: locationTask.updatedAt,
    location: locationTask.location,
    task: locationTask.task,
  };
}

function buildWhere(filters: LocationTaskListFilters): Prisma.LocationTaskWhereInput {
  const search = filters.query?.trim();
  const status =
    filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;

  return {
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.taskId ? { taskId: filters.taskId } : {}),
    ...(status === undefined ? {} : { active: status }),
    ...(search
      ? {
          OR: [
            {
              location: {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              },
            },
            {
              task: {
                name: { contains: search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

function buildOrderBy(
  sortBy: NonNullable<LocationTaskListFilters["sortBy"]>,
  sortOrder: "asc" | "desc",
) {
  return [{ [sortBy]: sortOrder } as Prisma.LocationTaskOrderByWithRelationInput];
}

async function ensureAssignmentDoesNotExist(
  prisma: Pick<PrismaClient, "locationTask">,
  locationId: string,
  taskId: string,
) {
  const existing = await prisma.locationTask.findFirst({
    where: { locationId, taskId },
    select: { id: true },
  });

  if (existing) {
    throw new LocationTaskManagementError(
      "LOCATION_TASK_EXISTS",
      "This cleaning task is already assigned to the selected location.",
      409,
    );
  }
}

async function loadLocationAndTask(
  prisma: Pick<PrismaClient, "location" | "cleaningTask">,
  locationId: string,
  taskId: string,
) {
  const [location, task] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId },
      select: locationSelect,
    }),
    prisma.cleaningTask.findUnique({
      where: { id: taskId },
      select: taskSelect,
    }),
  ]);

  if (!location) {
    throw new LocationTaskManagementError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  if (!task) {
    throw new LocationTaskManagementError("TASK_NOT_FOUND", "Cleaning task not found.", 404);
  }

  if (!location.active) {
    throw new LocationTaskManagementError(
      "LOCATION_INACTIVE",
      "Inactive locations cannot receive new task assignments.",
      400,
    );
  }

  if (!task.active) {
    throw new LocationTaskManagementError(
      "TASK_INACTIVE",
      "Inactive cleaning tasks cannot be assigned to locations.",
      400,
    );
  }

  return { location, task };
}

function locationTaskDescription(locationCode: string, taskName: string) {
  return `${locationCode} / ${taskName}`;
}

export async function listManagedLocationTasks(
  prisma: Pick<PrismaClient, "locationTask">,
  filters: LocationTaskListFilters,
): Promise<LocationTaskListResult> {
  const pageSize = Math.min(Math.max(toPositiveInt(filters.pageSize, 10), 1), 50);
  const page = Math.max(toPositiveInt(filters.page, 1), 1);
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const where = buildWhere(filters);

  const [total, locationTasks] = await Promise.all([
    prisma.locationTask.count({ where }),
    prisma.locationTask.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortOrder),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: buildLocationTaskSelect(),
    }),
  ]);

  return {
    locationTasks: locationTasks.map(mapLocationTask),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getManagedLocationTaskById(
  prisma: Pick<PrismaClient, "locationTask">,
  locationTaskId: string,
): Promise<LocationTaskListItem | null> {
  const locationTask = await prisma.locationTask.findUnique({
    where: { id: locationTaskId },
    select: buildLocationTaskSelect(),
  });

  return locationTask ? mapLocationTask(locationTask) : null;
}

export async function listLocationTaskReferenceData(
  prisma: Pick<PrismaClient, "location" | "cleaningTask">,
): Promise<LocationTaskReferenceData> {
  const [locations, tasks] = await Promise.all([
    prisma.location.findMany({
      select: locationSelect,
      orderBy: { code: "asc" },
    }),
    prisma.cleaningTask.findMany({
      select: taskSelect,
      orderBy: { name: "asc" },
    }),
  ]);

  return { locations, tasks };
}

export async function createManagedLocationTask(
  prisma: Pick<PrismaClient, "location" | "cleaningTask" | "locationTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  input: CreateLocationTaskInput,
): Promise<{ locationTask: LocationTaskListItem }> {
  const locationId = normalizeText(input.locationId);
  const taskId = normalizeText(input.taskId);

  if (!locationId) {
    throw new LocationTaskManagementError("INVALID_LOCATION", "Location is required.");
  }

  if (!taskId) {
    throw new LocationTaskManagementError("INVALID_TASK", "Cleaning task is required.");
  }

  const allocatedAmount = parseAllocatedAmount(input.allocatedAmount);
  const { location, task } = await loadLocationAndTask(prisma, locationId, taskId);

  if (input.frequency !== undefined && input.frequency !== task.frequency) {
    throw new LocationTaskManagementError(
      "FREQUENCY_MISMATCH",
      "The selected frequency must match the cleaning task frequency.",
    );
  }

  await ensureAssignmentDoesNotExist(prisma, locationId, taskId);

  let locationTask: LocationTaskRecord;
  try {
    locationTask = await prisma.locationTask.create({
      data: {
        locationId,
        taskId,
        frequency: task.frequency,
        allocatedAmount,
        active: input.active ?? true,
        isAdditional: input.isAdditional ?? false,
      },
      select: buildLocationTaskSelect(),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new LocationTaskManagementError(
        "LOCATION_TASK_EXISTS",
        "This cleaning task is already assigned to the selected location.",
        409,
      );
    }

    throw new LocationTaskManagementError(
      "DATABASE_CREATE_FAILED",
      "Unable to create the location task assignment.",
      500,
    );
  }

  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action: "LOCATION_TASK_CREATED" as ActivityAction,
      entityType: "LocationTask",
      entityId: locationTask.id,
      description: `Assigned ${task.name} to ${location.code}`,
      metadata: {
        locationId,
        taskId,
        locationCode: location.code,
        locationName: location.name,
        taskName: task.name,
        frequency: task.frequency,
        allocatedAmount: allocatedAmount.toFixed(2),
        active: input.active ?? true,
        isAdditional: input.isAdditional ?? false,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("Location task assignment created but audit logging failed", error);
  }

  return { locationTask: mapLocationTask(locationTask) };
}

export async function updateManagedLocationTask(
  prisma: Pick<PrismaClient, "locationTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  locationTaskId: string,
  input: UpdateLocationTaskInput,
): Promise<{ locationTask: LocationTaskListItem }> {
  const existing = await prisma.locationTask.findUnique({
    where: { id: locationTaskId },
    select: buildLocationTaskSelect(),
  });

  if (!existing) {
    throw new LocationTaskManagementError(
      "LOCATION_TASK_NOT_FOUND",
      "Location task assignment not found.",
      404,
    );
  }

  const updates: Prisma.LocationTaskUpdateInput = {};
  const logs: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.allocatedAmount !== undefined) {
    const allocatedAmount = parseAllocatedAmount(input.allocatedAmount);
    if (allocatedAmount.toString() !== existing.allocatedAmount.toString()) {
      updates.allocatedAmount = allocatedAmount;
      logs.push({
        action: "LOCATION_TASK_UPDATED" as ActivityAction,
        description: `Updated allocation for ${locationTaskDescription(
          existing.location.code,
          existing.task.name,
        )}`,
        metadata: {
          allocatedAmount: allocatedAmount.toFixed(2),
        },
      });
    }
  }

  if (input.active !== undefined && input.active !== existing.active) {
    updates.active = input.active;
    logs.push({
      action: input.active
        ? ("LOCATION_TASK_ACTIVATED" as ActivityAction)
        : ("LOCATION_TASK_DEACTIVATED" as ActivityAction),
      description: `${input.active ? "Activated" : "Deactivated"} assignment ${locationTaskDescription(
        existing.location.code,
        existing.task.name,
      )}`,
      metadata: { active: input.active },
    });
  }

  if (Object.keys(updates).length === 0) {
    return { locationTask: mapLocationTask(existing) };
  }

  let locationTask: LocationTaskRecord;
  try {
    locationTask = await prisma.locationTask.update({
      where: { id: locationTaskId },
      data: updates,
      select: buildLocationTaskSelect(),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new LocationTaskManagementError(
        "LOCATION_TASK_EXISTS",
        "This cleaning task is already assigned to the selected location.",
        409,
      );
    }

    throw new LocationTaskManagementError(
      "DATABASE_UPDATE_FAILED",
      "Unable to update the location task assignment.",
      500,
    );
  }

  for (const log of logs) {
    try {
      await createActivityLogIfSupported(prisma, {
        userId: actorUser.id,
        action: log.action,
        entityType: "LocationTask",
        entityId: locationTask.id,
        description: log.description,
        metadata: log.metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      console.error("Location task assignment updated but audit logging failed", error);
    }
  }

  return { locationTask: mapLocationTask(locationTask) };
}

export async function activateManagedLocationTask(
  prisma: Pick<PrismaClient, "locationTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  locationTaskId: string,
) {
  return updateManagedLocationTask(prisma, actorUser, locationTaskId, { active: true });
}

export async function deactivateManagedLocationTask(
  prisma: Pick<PrismaClient, "locationTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  locationTaskId: string,
) {
  return updateManagedLocationTask(prisma, actorUser, locationTaskId, { active: false });
}
