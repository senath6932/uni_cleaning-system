import type {
  ActivityAction,
  CleaningTask,
  Prisma,
  PrismaClient,
  TaskCategory,
  TaskFrequency,
} from "@/app/generated/prisma/client";
import {
  isTaskFrequency,
  taskFrequencies,
} from "@/lib/task-definitions";
import { createActivityLogIfSupported } from "@/lib/audit-logging";

export const allowedTaskFrequencies = taskFrequencies;

export type CleaningTaskListFilters = {
  query?: string;
  frequency?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "category" | "frequency" | "active" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type CleaningTaskListItem = Pick<
  CleaningTask,
  "id" | "name" | "category" | "frequency" | "active" | "createdAt" | "updatedAt"
>;

export type CleaningTaskListResult = {
  tasks: CleaningTaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateCleaningTaskInput = {
  name: string;
  frequency: string;
  active: boolean;
};

export type UpdateCleaningTaskInput = {
  name?: string;
  frequency?: string;
  active?: boolean;
};

export class CleaningTaskManagementError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CleaningTaskManagementError";
    this.code = code;
    this.status = status;
  }
}

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

function normalizeName(value: string) {
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

function validateFrequency(value: string) {
  if (!isTaskFrequency(value)) {
    throw new CleaningTaskManagementError(
      "INVALID_FREQUENCY",
      "The selected task frequency is not valid.",
    );
  }
}

async function ensureTaskNameAvailable(
  prisma: Pick<PrismaClient, "cleaningTask">,
  name: string,
  currentTaskId?: string,
) {
  const existing = await prisma.cleaningTask.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(currentTaskId ? { NOT: { id: currentTaskId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new CleaningTaskManagementError(
      "TASK_NAME_EXISTS",
      "A cleaning task with this name already exists.",
      409,
    );
  }
}

function buildTaskSelect() {
  return {
    id: true,
    name: true,
    category: true,
    frequency: true,
    active: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.CleaningTaskSelect;
}

function mapTask(task: CleaningTask): CleaningTaskListItem {
  return {
    id: task.id,
    name: task.name,
    category: task.category,
    frequency: task.frequency,
    active: task.active,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function getWhere(filters: CleaningTaskListFilters): Prisma.CleaningTaskWhereInput {
  const search = filters.query?.trim();
  const frequency =
    filters.frequency && isTaskFrequency(filters.frequency) ? filters.frequency : undefined;
  const status =
    filters.status === "active" ? true : filters.status === "inactive" ? false : undefined;

  return {
    ...(frequency ? { frequency } : {}),
    ...(status === undefined ? {} : { active: status }),
    ...(search
      ? {
          name: {
            contains: search,
            mode: "insensitive",
          },
        }
      : {}),
  };
}

function getOrderBy(
  sortBy: NonNullable<CleaningTaskListFilters["sortBy"]>,
  sortOrder: "asc" | "desc",
) {
  return [{ [sortBy]: sortOrder } as Prisma.CleaningTaskOrderByWithRelationInput];
}

export async function listManagedTasks(
  prisma: Pick<PrismaClient, "cleaningTask">,
  filters: CleaningTaskListFilters,
): Promise<CleaningTaskListResult> {
  const pageSize = Math.min(Math.max(toPositiveInt(filters.pageSize, 10), 1), 50);
  const page = Math.max(toPositiveInt(filters.page, 1), 1);
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const where = getWhere(filters);

  const [total, tasks] = await Promise.all([
    prisma.cleaningTask.count({ where }),
    prisma.cleaningTask.findMany({
      where,
      orderBy: getOrderBy(sortBy, sortOrder),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: buildTaskSelect(),
    }),
  ]);

  return {
    tasks: tasks.map(mapTask),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getManagedTaskById(
  prisma: Pick<PrismaClient, "cleaningTask">,
  taskId: string,
): Promise<CleaningTaskListItem | null> {
  const task = await prisma.cleaningTask.findUnique({
    where: { id: taskId },
    select: buildTaskSelect(),
  });

  return task ? mapTask(task) : null;
}

export async function createManagedTask(
  prisma: Pick<PrismaClient, "cleaningTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  input: CreateCleaningTaskInput,
): Promise<{ task: CleaningTaskListItem }> {
  const name = normalizeName(input.name);
  validateFrequency(input.frequency);
  const frequency = input.frequency as TaskFrequency;
  const category = input.frequency as TaskCategory;

  if (!name) {
    throw new CleaningTaskManagementError("INVALID_NAME", "Task name is required.");
  }

  await ensureTaskNameAvailable(prisma, name);

  let task: CleaningTask;
  try {
    task = await prisma.cleaningTask.create({
      data: {
        name,
        category,
        frequency,
        active: input.active,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CleaningTaskManagementError(
        "TASK_NAME_EXISTS",
        "A cleaning task with this name already exists.",
        409,
      );
    }

    throw new CleaningTaskManagementError(
      "DATABASE_CREATE_FAILED",
      "Unable to create the cleaning task.",
      500,
    );
  }

  try {
    await createActivityLogIfSupported(prisma, {
      userId: actorUser.id,
      action: "CLEANING_TASK_CREATED" as ActivityAction,
      entityType: "CleaningTask",
      entityId: task.id,
      description: `Created cleaning task ${task.name}`,
      metadata: {
        name: task.name,
        category: task.category,
        frequency: task.frequency,
        active: task.active,
      } as Prisma.InputJsonValue,
    });
  } catch (error) {
    console.error("Cleaning task created but audit logging failed", error);
  }

  return { task: mapTask(task) };
}

export async function updateManagedTask(
  prisma: Pick<PrismaClient, "cleaningTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  taskId: string,
  input: UpdateCleaningTaskInput,
): Promise<{ task: CleaningTaskListItem }> {
  const existing = await prisma.cleaningTask.findUnique({
    where: { id: taskId },
    select: buildTaskSelect(),
  });

  if (!existing) {
    throw new CleaningTaskManagementError("TASK_NOT_FOUND", "Task not found.", 404);
  }

  const updates: Prisma.CleaningTaskUpdateInput = {};
  const logs: {
    action: ActivityAction;
    description: string;
    metadata: JsonObject;
  }[] = [];

  if (input.name !== undefined) {
    const name = normalizeName(input.name);
    if (!name) {
      throw new CleaningTaskManagementError("INVALID_NAME", "Task name is required.");
    }

    if (name !== existing.name) {
      await ensureTaskNameAvailable(prisma, name, existing.id);
      updates.name = name;
    }
  }

  if (input.frequency !== undefined) {
    validateFrequency(input.frequency);
    if (input.frequency !== existing.frequency) {
      updates.frequency = input.frequency as TaskFrequency;
      updates.category = input.frequency as TaskCategory;
    }
  }

  if (input.active !== undefined && input.active !== existing.active) {
    updates.active = input.active;
    logs.push({
      action: input.active
        ? ("CLEANING_TASK_ACTIVATED" as ActivityAction)
        : ("CLEANING_TASK_DEACTIVATED" as ActivityAction),
      description: `${input.active ? "Activated" : "Deactivated"} cleaning task ${existing.name}`,
      metadata: { active: input.active },
    });
  }

  const changesMade =
    input.name !== undefined ||
    input.frequency !== undefined ||
    input.active !== undefined;

  if (!changesMade || Object.keys(updates).length === 0 && logs.length === 0) {
    return { task: existing };
  }

  const hadTextChanges =
    (input.name !== undefined && normalizeName(input.name) !== existing.name) ||
    (input.frequency !== undefined && input.frequency !== existing.frequency);

  if (hadTextChanges) {
    logs.unshift({
      action: "CLEANING_TASK_UPDATED" as ActivityAction,
      description: `Updated cleaning task ${existing.name}`,
      metadata: {
        name: input.name !== undefined ? normalizeName(input.name) : existing.name,
        frequency: input.frequency ?? existing.frequency,
      },
    });
  }

  let task: CleaningTask;
  try {
    task = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: updates,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CleaningTaskManagementError(
        "TASK_NAME_EXISTS",
        "A cleaning task with this name already exists.",
        409,
      );
    }

    throw new CleaningTaskManagementError(
      "DATABASE_UPDATE_FAILED",
      "Unable to update the cleaning task.",
      500,
    );
  }

  for (const log of logs) {
    try {
      await createActivityLogIfSupported(prisma, {
        userId: actorUser.id,
        action: log.action,
        entityType: "CleaningTask",
        entityId: task.id,
        description: log.description,
        metadata: log.metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      console.error("Cleaning task updated but audit logging failed", error);
    }
  }

  return { task: mapTask(task) };
}

export async function activateManagedTask(
  prisma: Pick<PrismaClient, "cleaningTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  taskId: string,
) {
  return updateManagedTask(prisma, actorUser, taskId, { active: true });
}

export async function deactivateManagedTask(
  prisma: Pick<PrismaClient, "cleaningTask" | "activityLog" | "$queryRaw">,
  actorUser: { id: string; name: string },
  taskId: string,
) {
  return updateManagedTask(prisma, actorUser, taskId, { active: false });
}
