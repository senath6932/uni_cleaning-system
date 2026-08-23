import type { ActivityAction, Location, Prisma, PrismaClient, User } from "@/app/generated/prisma/client";
import {
  dateStringToUtcDate,
  getBusinessDateString,
  getBusinessTimeZone,
  isFutureBusinessDate,
  isValidDateString,
  normalizeDateString,
} from "@/lib/business-date";
import { canPhiAccessLocation } from "@/lib/phi-assignments";

export type PHIAuthorizedLocation = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  assignmentActive: boolean;
  totalWorkers: number;
};

export type PHIMonitoringData = {
  selectedDate: string;
  selectedLocationId: string;
  locations: PHIAuthorizedLocation[];
  location: Pick<Location, "id" | "code" | "name" | "active"> | null;
  totalWorkers: number;
  totalPresentCount: number | null;
  remark: string | null;
  finalized: boolean;
  finalizedAt: Date | null;
  lockedAt: Date | null;
};

export type PHIAttendanceHistoryItem = {
  id: string;
  attendanceDate: string;
  totalPresentCount: number;
  remark: string | null;
  finalized: boolean;
  finalizedAt: Date | null;
  updatedAt: Date;
  location: Pick<Location, "id" | "code" | "name">;
};

export type SavePHIAttendanceInput = {
  locationId: string;
  attendanceDate: string;
  totalPresentCount: unknown;
  remark?: unknown;
  finalize?: boolean;
};

export class PHIAttendanceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PHIAttendanceError";
    this.code = code;
    this.status = status;
  }
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

function normalizeRemark(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseTotalPresentCount(value: unknown) {
  if (value === "" || value === undefined || value === null) {
    throw new PHIAttendanceError("INVALID_COUNT", "Total present count is required.");
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
      throw new PHIAttendanceError(
        "INVALID_COUNT",
        "Total present count must be a whole number greater than or equal to zero.",
      );
    }
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new PHIAttendanceError(
        "INVALID_COUNT",
        "Total present count must be a whole number greater than or equal to zero.",
      );
    }

    return Number(trimmed);
  }

  throw new PHIAttendanceError(
    "INVALID_COUNT",
    "Total present count must be a whole number greater than or equal to zero.",
  );
}

function getBusinessDate(date = new Date()) {
  return getBusinessDateString(date, getBusinessTimeZone());
}

type AttendanceHistoryRecord = Prisma.DailyAttendanceEvaluationGetPayload<{
  select: {
    id: true;
    locationId: true;
    phiUserId: true;
    attendanceDate: true;
    totalPresentCount: true;
    remark: true;
    finalized: true;
    finalizedAt: true;
    lockedAt: true;
    createdAt: true;
    updatedAt: true;
    location: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
  };
}>;

function mapHistoryRecord(record: AttendanceHistoryRecord): PHIAttendanceHistoryItem {
  return {
    id: record.id,
    attendanceDate: getBusinessDate(record.attendanceDate),
    totalPresentCount: record.totalPresentCount,
    remark: record.remark,
    finalized: Boolean(record.finalized || record.finalizedAt || record.lockedAt),
    finalizedAt: record.finalizedAt,
    updatedAt: record.updatedAt,
    location: record.location,
  };
}

export async function listPhiAuthorizedLocations(
  prisma: Pick<PrismaClient, "pHIAssignment" | "workerLocationAssignment">,
  phiUserId: string,
): Promise<PHIAuthorizedLocation[]> {
  const assignments = await prisma.pHIAssignment.findMany({
    where: { userId: phiUserId, active: true },
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

  const locations: PHIAuthorizedLocation[] = [];

  for (const assignment of assignments) {
    const totalWorkers = await prisma.workerLocationAssignment.count({
      where: {
        locationId: assignment.location.id,
        active: true,
      },
    });

    locations.push({
      id: assignment.location.id,
      code: assignment.location.code,
      name: assignment.location.name,
      active: assignment.location.active,
      assignmentActive: assignment.active,
      totalWorkers,
    });
  }

  return locations;
}

export async function getPHIMonitoringData(
  prisma: Pick<
    PrismaClient,
    "pHIAssignment" | "location" | "workerLocationAssignment" | "dailyAttendanceEvaluation"
  >,
  phiUserId: string,
  selectedLocationId: string,
  selectedDate: string,
): Promise<PHIMonitoringData> {
  const normalizedDate = normalizeDateString(selectedDate);
  if (!isValidDateString(normalizedDate)) {
    throw new PHIAttendanceError("INVALID_DATE", "The selected date is not valid.");
  }

  if (isFutureBusinessDate(normalizedDate)) {
    throw new PHIAttendanceError("FUTURE_DATE", "Future attendance is not allowed.");
  }

  const locations = await listPhiAuthorizedLocations(prisma, phiUserId);
  if (locations.length === 0) {
    return {
      selectedDate: normalizedDate,
      selectedLocationId: "",
      locations: [],
      location: null,
      totalWorkers: 0,
      totalPresentCount: null,
      remark: null,
      finalized: false,
      finalizedAt: null,
      lockedAt: null,
    };
  }

  const allowedLocationIds = new Set(locations.map((location) => location.id));
  const locationId = allowedLocationIds.has(selectedLocationId)
    ? selectedLocationId
    : locations[0]?.id ?? "";

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
    throw new PHIAttendanceError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  const totalWorkers = await prisma.workerLocationAssignment.count({
    where: { locationId, active: true },
  });

  const attendanceDate = dateStringToUtcDate(normalizedDate);
  if (!attendanceDate) {
    throw new PHIAttendanceError("INVALID_DATE", "The selected date is not valid.");
  }

  const current = await prisma.dailyAttendanceEvaluation.findFirst({
    where: {
      locationId,
      attendanceDate,
    },
  });

  return {
    selectedDate: normalizedDate,
    selectedLocationId: locationId,
    locations,
    location,
    totalWorkers,
    totalPresentCount: current?.totalPresentCount ?? null,
    remark: current?.remark ?? null,
    finalized: Boolean(current?.finalized || current?.finalizedAt || current?.lockedAt),
    finalizedAt: current?.finalizedAt ?? null,
    lockedAt: current?.lockedAt ?? null,
  };
}

export async function listPHIAttendanceHistory(
  prisma: Pick<PrismaClient, "dailyAttendanceEvaluation">,
  phiUserId: string,
) {
  const records = await prisma.dailyAttendanceEvaluation.findMany({
    where: { phiUserId },
    orderBy: [{ attendanceDate: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      locationId: true,
      phiUserId: true,
      attendanceDate: true,
      totalPresentCount: true,
      remark: true,
      finalized: true,
      finalizedAt: true,
      lockedAt: true,
      createdAt: true,
      updatedAt: true,
      location: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  return records.map(mapHistoryRecord);
}

export async function savePHIAttendanceEvaluation(
  prisma: Pick<
    PrismaClient,
    "pHIAssignment" | "location" | "dailyAttendanceEvaluation" | "activityLog" | "$transaction"
  >,
  actorUser: Pick<User, "id" | "name" | "role" | "active">,
  input: SavePHIAttendanceInput,
) {
  if (actorUser.role !== "PHI" || !actorUser.active) {
    throw new PHIAttendanceError("ACCESS_DENIED", "Access denied.", 403);
  }

  const locationId = normalizeText(input.locationId);
  const attendanceDateText = normalizeText(input.attendanceDate);
  if (!locationId) {
    throw new PHIAttendanceError("INVALID_LOCATION", "Location is required.");
  }

  if (!isValidDateString(attendanceDateText)) {
    throw new PHIAttendanceError("INVALID_DATE", "The selected date is not valid.");
  }

  if (isFutureBusinessDate(attendanceDateText)) {
    throw new PHIAttendanceError("FUTURE_DATE", "Future attendance is not allowed.");
  }

  const hasAccess = await canPhiAccessLocation(prisma, actorUser.id, locationId);
  if (!hasAccess) {
    throw new PHIAttendanceError("ACCESS_DENIED", "Access denied.", 403);
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
    throw new PHIAttendanceError("LOCATION_NOT_FOUND", "Location not found.", 404);
  }

  const attendanceDate = dateStringToUtcDate(attendanceDateText);
  if (!attendanceDate) {
    throw new PHIAttendanceError("INVALID_DATE", "The selected date is not valid.");
  }

  const totalPresentCount = parseTotalPresentCount(input.totalPresentCount);
  const remark = normalizeRemark(input.remark);
  const finalize = Boolean(input.finalize);
  const now = new Date();

  const existing = await prisma.dailyAttendanceEvaluation.findFirst({
    where: {
      locationId,
      attendanceDate,
    },
  });

  if (existing?.lockedAt && !(finalize && existing.totalPresentCount === totalPresentCount && existing.remark === remark)) {
    throw new PHIAttendanceError(
      "ATTENDANCE_FINALIZED",
      "Finalized attendance records cannot be modified.",
      400,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (existing) {
        const updated = await tx.dailyAttendanceEvaluation.update({
          where: { id: existing.id },
          data: {
            totalPresentCount,
            remark,
            finalized: finalize ? true : existing.finalized,
            ...(finalize
              ? {
                  finalizedAt: existing.finalizedAt ?? now,
                  lockedAt: existing.lockedAt ?? now,
                }
              : {}),
          },
        });

        await tx.activityLog.create({
          data: {
            userId: actorUser.id,
            action: (finalize
              ? "ATTENDANCE_EVALUATION_FINALIZED"
              : "ATTENDANCE_EVALUATION_UPDATED") as ActivityAction,
            entityType: "DailyAttendanceEvaluation",
            entityId: updated.id,
            description: `${finalize ? "Finalized" : "Updated"} attendance evaluation for ${location.code}`,
            metadata: {
              locationId,
              phiId: actorUser.id,
              attendanceDate: attendanceDateText,
              totalPresentCount,
              remark,
            } as Prisma.InputJsonValue,
          },
        });

        return updated;
      }

      const created = await tx.dailyAttendanceEvaluation.create({
        data: {
          locationId,
          phiUserId: actorUser.id,
          attendanceDate,
          totalPresentCount,
          remark,
          finalized: finalize,
          ...(finalize
            ? {
                finalizedAt: now,
                lockedAt: now,
              }
            : {}),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actorUser.id,
          action: (finalize
            ? "ATTENDANCE_EVALUATION_FINALIZED"
            : "ATTENDANCE_EVALUATION_CREATED") as ActivityAction,
          entityType: "DailyAttendanceEvaluation",
          entityId: created.id,
          description: `${finalize ? "Finalized" : "Created"} attendance evaluation for ${location.code}`,
          metadata: {
            locationId,
            phiId: actorUser.id,
            attendanceDate: attendanceDateText,
            totalPresentCount,
            remark,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return result;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PHIAttendanceError(
        "ATTENDANCE_EXISTS",
        "An attendance record already exists for this location and date.",
        409,
      );
    }

    throw new PHIAttendanceError("DATABASE_SAVE_FAILED", "Unable to save the attendance.", 500);
  }
}
