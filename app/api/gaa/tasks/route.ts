import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createManagedTask,
  listManagedTasks,
  type CleaningTaskListFilters,
  CleaningTaskManagementError,
} from "@/lib/task-management";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof CleaningTaskManagementError) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "AUTH_ERROR";
    return NextResponse.json(
      { error: error.message, code },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: "An unexpected error occurred." },
    { status: 500 },
  );
}

function parseQueryParams(searchParams: URLSearchParams): CleaningTaskListFilters {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  return {
    query: searchParams.get("query") ?? undefined,
    frequency: searchParams.get("frequency") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    sortBy:
      sortBy === "name" ||
      sortBy === "category" ||
      sortBy === "frequency" ||
      sortBy === "active" ||
      sortBy === "createdAt"
        ? sortBy
        : "createdAt",
    sortOrder: sortOrder === "asc" ? "asc" : "desc",
  };
}

export async function GET(request: Request) {
  try {
    await requireRole("GAA");
    const url = new URL(request.url);
    const result = await listManagedTasks(prisma, parseQueryParams(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { appUser } = await requireRole("GAA");
    const body = (await request.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name : "";
    const frequency =
      typeof body.frequency === "string" ? body.frequency : "";
    const active = typeof body.active === "boolean" ? body.active : true;

    const result = await createManagedTask(
      prisma,
      { id: appUser.id, name: appUser.name },
      { name, frequency, active },
    );

    return NextResponse.json(
      {
        task: result.task,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
