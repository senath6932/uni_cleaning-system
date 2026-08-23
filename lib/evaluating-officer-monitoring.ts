import type {
  ActivityAction,
  EvaluationResult,
  CleaningTask,
  Location,
  Prisma,
  PrismaClient,
  TaskFrequency,
  User,
} from "@/app/generated/prisma/client";
import {
  dateStringToUtcDate,
  getBusinessDateString,
  getBusinessTimeZone,
  isValidDateString,
  normalizeDateString,
} from "@/lib/business-date";
import { canEvaluatingOfficerAccessLocation } from "@/lib/evaluating-officer-assignments";

export const allowedEvaluationResults = ["P", "X", "NA"] as const;
export type EvaluationResultValue = (typeof allowedEvaluationResults)[number];

export type OfficerLocationSummary = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  assignmentActive: boolean;
  activeTaskCount: number;
  evaluatedTaskCount: number;
};

export type OfficerMonitoringTask = {
  id: string;
  locationTaskId: string;
  taskName: string;
  frequency: TaskFrequency;
  active: boolean;
  eligible: boolean;
  eligibilityNote: string | null;
  result: EvaluationResultValue | null;
  remark: string | null;
  finalized: boolean;
  finalizedAt: Date | null;
  lockedAt: Date | null;
};

export type OfficerMonitoringData = {
  selectedDate: string;
  selectedLocationId: string;
  locations: OfficerLocationSummary[];
  location: Pick<Location, "id" | "code" | "name" | "active"> | null;
  tasks: OfficerMonitoringTask[];
};

export type OfficerEvaluationHistoryItem = {
  id: string;
  evaluationDate: string;
  result: EvaluationResultValue;
  remark: string | null;
  finalized: boolean;
  finalizedAt: Date | null;
  updatedAt: Date;
  location: Pick<Location, "id" | "code" | "name">;
  task: Pick<CleaningTask, "id" | "name" | "frequency">;
};

export type SaveOfficerEvaluationsInput = {
  locationId: string;
  evaluationDate: string;
  finalize?: boolean;
  items: Array<{
    locationTaskId: string;
    result: string;
    remark?: string;
  }>;
};

export class OfficerMonitoringError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "OfficerMonitoringError";
    this.code = code;
    this.status = status;
  }
}

const taskSelect = {
  id: true,
  active: true,
  frequency: true,
  createdAt: true,
  task: {
    select: {
      id: true,
      name: true,
      frequency: true,
      active: true,
    },
  },
  location: {
    select: {
      id: true,
      code: true,
      name: true,
      active: true,
    },
  },
} satisfies Prisma.LocationTaskSelect;

const evaluationSelect = {
  id: true,
  locationId: true,
  locationTaskId: true,
  evaluatingOfficerId: true,
  evaluationDate: true,
  occurrenceKey: true,
  result: true,
  remark: true,
  createdAt: true,
  updatedAt: true,
  finalizedAt: true,
  lockedAt: true,
  location: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  locationTask: {
    select: {
      id: true,
      frequency: true,
      task: {
        select: {
          id: true,
          name: true,
          frequency: true,
        },
      },
    },
  },
} satisfies Prisma.DailyCleaningEvaluationSelect;

type EvaluationRecord = Prisma.DailyCleaningEvaluationGetPayload<{
  select: typeof evaluationSelect;
}>;

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

function normalizeRemark(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isEvaluationResult(value: string): value is EvaluationResultValue {
  return (allowedEvaluationResults as readonly string[]).includes(value);
}

function getBusinessDate(date = new Date()) {
  return getBusinessDateString(date, getBusinessTimeZone());
}

function assertTodayOnly(selectedDate: string) {
  const today = getBusinessDate();
  if (selectedDate > today) {
    throw new OfficerMonitoringError(
      "FUTURE_DATE",
      "Future evaluations are not allowed.",
      400,
    );
  }

  if (selectedDate < today) {
    throw new OfficerMonitoringError(
      "PAST_DATE",
      "Past evaluations cannot be edited.",
      400,
    );
  }
}

function getBusinessWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getBusinessTimeZone(),
    weekday: "short",
  }).format(date);
}

function getBusinessDayOfMonth(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: getBusinessTimeZone(),
      day: "2-digit",
    }).format(date),
  );
}

function isEligibleForDate(task: { frequency: TaskFrequency; createdAt: Date }, date: string) {
  if (!isValidDateString(date)) {
    return false;
  }

  const target = dateStringToUtcDate(date);
  if (!target) {
    return false;
  }

  if (getBusinessDate(target) < getBusinessDate(task.createdAt)) {
    return false;
  }

  if (task.frequency === "DAILY") {
    return true;
  }

  if (task.frequency === "WEEKLY") {
    return getBusinessWeekday(target) === getBusinessWeekday(task.createdAt);
  }

  return getBusinessDayOfMonth(target) === getBusinessDayOfMonth(task.createdAt);
}

function mapEvaluation(record: EvaluationRecord): OfficerMonitoringTask {
  return {
    id: record.id,
    locationTaskId: record.locationTaskId,
    taskName: record.locationTask.task.name,
    frequency: record.locationTask.frequency,
    active: true,
    eligible: true,
    eligibilityNote: null,
    result: record.result,
    remark: record.remark,
    finalized: Boolean(record.finalizedAt || record.lockedAt),
    finalizedAt: record.finalizedAt,
    lockedAt: record.lockedAt,
  };
}

async function loadOfficerLocationAssignments(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment">,
  officerId: string,
) {
  return prisma.evaluatingOfficerAssignment.findMany({
    where: { userId: officerId, active: true },
    select: {
      id: true,
      active: true,
      location: {
        select: {
          id: true,
          code: true,
          name: true,
          active: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function listOfficerMonitoringLocations(
  prisma: Pick<PrismaClient, "evaluatingOfficerAssignment" | "locationTask" | "dailyCleaningEvaluation">,
  officerId: string,
  evaluationDate = getBusinessDate(),
) {
  const assignments = await loadOfficerLocationAssignments(prisma, officerId);

  const summaries: OfficerLocationSummary[] = [];

  for (const assignment of assignments) {
    const [activeTaskCount, evaluatedTaskCount] = await Promise.all([
      prisma.locationTask.count({
        where: { locationId: assignment.location.id, active: true },
      }),
      prisma.dailyCleaningEvaluation.count({
        where: {
          evaluatingOfficerId: officerId,
          locationId: assignment.location.id,
          evaluationDate: dateStringToUtcDate(evaluationDate) ?? new Date(),
        },
      }),
    ]);

    summaries.push({
      id: assignment.location.id,
      code: assignment.location.code,
      name: assignment.location.name,
      active: assignment.location.active,
      assignmentActive: assignment.active,
      activeTaskCount,
      evaluatedTaskCount,
    });
  }

  return summaries;
}

export async function getOfficerMonitoringData(
  prisma: Pick<
    PrismaClient,
    "evaluatingOfficerAssignment" | "location" | "locationTask" | "dailyCleaningEvaluation"
  >,
  officerId: string,
  selectedLocationId: string,
  selectedDate: string,
): Promise<OfficerMonitoringData> {
  const normalizedDate = normalizeDateString(selectedDate);
  if (!isValidDateString(normalizedDate)) {
    throw new OfficerMonitoringError("INVALID_DATE", "The selected date is not valid.");
  }

  assertTodayOnly(normalizedDate);

  const assignments = await loadOfficerLocationAssignments(prisma, officerId);
  if (assignments.length === 0) {
    return {
      selectedDate: normalizedDate,
      selectedLocationId: "",
      locations: [],
      location: null,
      tasks: [],
    };
  }

  const allowedLocationIds = new Set(assignments.map((assignment) => assignment.location.id));
  const locationId = allowedLocationIds.has(selectedLocationId)
    ? selectedLocationId
    : assignments[0]?.location.id ?? "";

  if (!locationId) {
    return {
      selectedDate: normalizedDate,
      selectedLocationId: "",
      locations: [],
      location: null,
      tasks: [],
    };
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      code: true,
      name: true,
      active: true,
    },
  });

  if (!location) {
    throw new OfficerMonitoringError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  const locationTasks = await prisma.locationTask.findMany({
    where: { locationId, active: true },
    select: taskSelect,
    orderBy: [{ createdAt: "asc" }],
  });

  const evaluationDate = dateStringToUtcDate(normalizedDate);
  if (!evaluationDate) {
    throw new OfficerMonitoringError("INVALID_DATE", "The selected date is not valid.");
  }

  const records = await prisma.dailyCleaningEvaluation.findMany({
    where: {
      evaluatingOfficerId: officerId,
      locationId,
      evaluationDate,
    },
    select: evaluationSelect,
  });

  const recordByLocationTaskId = new Map(records.map((record) => [record.locationTaskId, record]));

  const tasks: OfficerMonitoringTask[] = locationTasks.map((locationTask) => {
    const eligible = isEligibleForDate(locationTask, normalizedDate);
    const record = recordByLocationTaskId.get(locationTask.id);

    return {
      id: locationTask.id,
      locationTaskId: locationTask.id,
      taskName: locationTask.task.name,
      frequency: locationTask.frequency,
      active: locationTask.active,
      eligible,
      eligibilityNote: eligible
        ? null
        : locationTask.frequency === "WEEKLY"
          ? "This weekly task is not scheduled for this date."
          : locationTask.frequency === "MONTHLY"
            ? "This monthly task is not scheduled for this date."
            : null,
      result: record ? (record.result as EvaluationResultValue) : null,
      remark: record?.remark ?? null,
      finalized: Boolean(record?.finalizedAt || record?.lockedAt),
      finalizedAt: record?.finalizedAt ?? null,
      lockedAt: record?.lockedAt ?? null,
    };
  });

  return {
    selectedDate: normalizedDate,
    selectedLocationId: locationId,
    locations: assignments.map((assignment) => ({
      id: assignment.location.id,
      code: assignment.location.code,
      name: assignment.location.name,
      active: assignment.location.active,
      assignmentActive: assignment.active,
      activeTaskCount: 0,
      evaluatedTaskCount: 0,
    })),
    location,
    tasks,
  };
}

export async function listOfficerEvaluationHistory(
  prisma: Pick<PrismaClient, "dailyCleaningEvaluation">,
  officerId: string,
) {
  const records = await prisma.dailyCleaningEvaluation.findMany({
    where: { evaluatingOfficerId: officerId },
    orderBy: [{ evaluationDate: "desc" }, { updatedAt: "desc" }],
    select: evaluationSelect,
    take: 100,
  });

  return records.map((record) => ({
    id: record.id,
    evaluationDate: getBusinessDate(record.evaluationDate),
    result: record.result as EvaluationResultValue,
    remark: record.remark,
    finalized: Boolean(record.finalizedAt || record.lockedAt),
    finalizedAt: record.finalizedAt,
    updatedAt: record.updatedAt,
    location: record.location,
    task: record.locationTask.task,
  }));
}

export type SaveOfficerEvaluationsInputRecord = {
  locationTaskId: string;
  result: string;
  remark?: string;
};

export async function saveOfficerEvaluations(
  prisma: Pick<
    PrismaClient,
    "evaluatingOfficerAssignment" | "locationTask" | "dailyCleaningEvaluation" | "activityLog" | "$transaction"
  >,
  actorUser: Pick<User, "id" | "name" | "role" | "active">,
  input: SaveOfficerEvaluationsInput,
) {
  if (actorUser.role !== "EVALUATING_OFFICER" || !actorUser.active) {
    throw new OfficerMonitoringError("ACCESS_DENIED", "Access denied.", 403);
  }

  const locationId = normalizeText(input.locationId);
  const selectedDate = normalizeDateString(input.evaluationDate);
  if (!locationId) {
    throw new OfficerMonitoringError("INVALID_LOCATION", "Location is required.");
  }

  if (!isValidDateString(selectedDate)) {
    throw new OfficerMonitoringError("INVALID_DATE", "The selected date is not valid.");
  }

  assertTodayOnly(selectedDate);

  const evaluationDate = dateStringToUtcDate(selectedDate);
  if (!evaluationDate) {
    throw new OfficerMonitoringError("INVALID_DATE", "The selected date is not valid.");
  }

  const hasAccess = await canEvaluatingOfficerAccessLocation(
    prisma,
    actorUser.id,
    locationId,
  );
  if (!hasAccess) {
    throw new OfficerMonitoringError("ACCESS_DENIED", "Access denied.", 403);
  }

  const locationTasks = await prisma.locationTask.findMany({
    where: { locationId, active: true },
    select: taskSelect,
    orderBy: [{ createdAt: "asc" }],
  });

  const eligibleTasks = locationTasks.filter((locationTask) => isEligibleForDate(locationTask, selectedDate));
  const eligibleTaskIds = new Set(eligibleTasks.map((task) => task.id));

  for (const item of input.items) {
    if (!eligibleTaskIds.has(item.locationTaskId)) {
      throw new OfficerMonitoringError(
        "TASK_NOT_ELIGIBLE",
        "The selected task is not eligible for this date.",
      );
    }

    if (!isEvaluationResult(item.result)) {
      throw new OfficerMonitoringError(
        "INVALID_RESULT",
        "The selected evaluation result is not valid.",
      );
    }
  }

  if (input.items.length !== eligibleTasks.length) {
    throw new OfficerMonitoringError(
      "INCOMPLETE_EVALUATION",
      "Every eligible task must be evaluated before saving.",
    );
  }

  const itemMap = new Map(input.items.map((item) => [item.locationTaskId, item]));
  const records = await prisma.dailyCleaningEvaluation.findMany({
    where: {
      evaluatingOfficerId: actorUser.id,
      locationId,
      evaluationDate,
    },
    select: evaluationSelect,
  });
  const existingByLocationTaskId = new Map(records.map((record) => [record.locationTaskId, record]));
  const finalize = Boolean(input.finalize);
  const now = new Date();

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const output: EvaluationRecord[] = [];

      for (const locationTask of eligibleTasks) {
        const submitted = itemMap.get(locationTask.id);
        if (!submitted) {
          throw new OfficerMonitoringError(
            "INCOMPLETE_EVALUATION",
            "Every eligible task must be evaluated before saving.",
          );
        }

        const current = existingByLocationTaskId.get(locationTask.id);
        const remark = normalizeRemark(submitted.remark);
        const result = submitted.result as EvaluationResult;

        if (current && (current.finalizedAt || current.lockedAt)) {
          const unchanged =
            current.result === result &&
            (current.remark ?? null) === remark &&
            (!finalize || current.finalizedAt);

          if (!unchanged) {
            throw new OfficerMonitoringError(
              "EVALUATION_FINALIZED",
              "Finalized evaluations cannot be modified.",
              400,
            );
          }

          output.push(current);
          continue;
        }

        if (current) {
          const updated = await tx.dailyCleaningEvaluation.update({
            where: { id: current.id },
            data: {
              result,
              remark,
              ...(finalize
                ? {
                    finalizedAt: now,
                    lockedAt: now,
                  }
                : {}),
            },
            select: evaluationSelect,
          });

          await tx.activityLog.create({
            data: {
              userId: actorUser.id,
              action: (finalize
                ? "DAILY_EVALUATION_FINALIZED"
                : "DAILY_EVALUATION_UPDATED") as ActivityAction,
              entityType: "DailyCleaningEvaluation",
              entityId: updated.id,
              description: `${finalize ? "Finalized" : "Updated"} cleaning evaluation for ${locationTask.task.name}`,
              metadata: {
                locationId,
                locationTaskId: locationTask.id,
                evaluationDate: selectedDate,
                result,
                remark,
              } as Prisma.InputJsonValue,
            },
          });

          output.push(updated);
          continue;
        }

        const created = await tx.dailyCleaningEvaluation.create({
          data: {
            locationId,
            locationTaskId: locationTask.id,
            evaluatingOfficerId: actorUser.id,
            evaluationDate,
            occurrenceKey: "default",
            result,
            remark,
            ...(finalize
              ? {
                  finalizedAt: now,
                  lockedAt: now,
                }
              : {}),
          },
          select: evaluationSelect,
        });

        await tx.activityLog.create({
          data: {
            userId: actorUser.id,
            action: (finalize
              ? "DAILY_EVALUATION_FINALIZED"
              : "DAILY_EVALUATION_CREATED") as ActivityAction,
            entityType: "DailyCleaningEvaluation",
            entityId: created.id,
            description: `${finalize ? "Finalized" : "Created"} cleaning evaluation for ${locationTask.task.name}`,
            metadata: {
              locationId,
              locationTaskId: locationTask.id,
              evaluationDate: selectedDate,
              result,
              remark,
            } as Prisma.InputJsonValue,
          },
        });

        output.push(created);
      }

      return output;
    });

    return { evaluations: saved.map(mapEvaluation) };
  } catch (error) {
    if (error instanceof OfficerMonitoringError) {
      throw error;
    }

    if (isUniqueConstraintError(error)) {
      throw new OfficerMonitoringError(
        "DUPLICATE_EVALUATION",
        "An evaluation already exists for this task and date.",
        409,
      );
    }

    throw new OfficerMonitoringError(
      "DATABASE_SAVE_FAILED",
      "Unable to save the evaluation.",
      500,
    );
  }
}
