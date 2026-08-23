import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createManagedLocationTask,
  listManagedLocationTasks,
  type LocationTaskListFilters,
  LocationTaskManagementError,
} from "@/lib/location-task-management";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof LocationTaskManagementError) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "AUTH_ERROR";
    return NextResponse.json({ error: error.message, code }, { status: error.status });
  }

  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}

function parseQueryParams(searchParams: URLSearchParams): LocationTaskListFilters {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  return {
    query: searchParams.get("query") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    taskId: searchParams.get("taskId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    sortBy: sortBy === "allocatedAmount" || sortBy === "active" ? sortBy : "createdAt",
    sortOrder: sortOrder === "asc" ? "asc" : "desc",
  };
}

export async function GET(request: Request) {
  try {
    await requireRole("GAA");
    const url = new URL(request.url);
    const result = await listManagedLocationTasks(prisma, parseQueryParams(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { appUser } = await requireRole("GAA");
    const body = (await request.json()) as Record<string, unknown>;

    const locationId = typeof body.locationId === "string" ? body.locationId : "";
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    const allocatedAmount = body.allocatedAmount;
    const active = typeof body.active === "boolean" ? body.active : true;
    const frequency = typeof body.frequency === "string" ? body.frequency : undefined;
    const isAdditional = typeof body.isAdditional === "boolean" ? body.isAdditional : undefined;

    const result = await createManagedLocationTask(
      prisma,
      { id: appUser.id, name: appUser.name },
      {
        locationId,
        taskId,
        allocatedAmount,
        active,
        frequency,
        isAdditional,
      },
    );

    return NextResponse.json(
      {
        locationTask: result.locationTask,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
