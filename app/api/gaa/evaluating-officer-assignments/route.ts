import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createManagedEvaluatingOfficerAssignment,
  listManagedEvaluatingOfficerAssignments,
  type EvaluatingOfficerAssignmentListFilters,
  EvaluatingOfficerAssignmentError,
} from "@/lib/evaluating-officer-assignments";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof EvaluatingOfficerAssignmentError) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "AUTH_ERROR";
    return NextResponse.json({ error: error.message, code }, { status: error.status });
  }

  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}

function parseQueryParams(searchParams: URLSearchParams): EvaluatingOfficerAssignmentListFilters {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  return {
    query: searchParams.get("query") ?? undefined,
    officerId: searchParams.get("officerId") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    sortBy: sortBy === "active" ? sortBy : "createdAt",
    sortOrder: sortOrder === "asc" ? "asc" : "desc",
  };
}

export async function GET(request: Request) {
  try {
    await requireRole("GAA");
    const url = new URL(request.url);
    const result = await listManagedEvaluatingOfficerAssignments(prisma, parseQueryParams(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { appUser } = await requireRole("GAA");
    const body = (await request.json()) as Record<string, unknown>;

    const userId = typeof body.userId === "string" ? body.userId : "";
    const locationId = typeof body.locationId === "string" ? body.locationId : "";
    const active = typeof body.active === "boolean" ? body.active : true;

    const result = await createManagedEvaluatingOfficerAssignment(
      prisma,
      { id: appUser.id, name: appUser.name },
      { userId, locationId, active },
    );

    return NextResponse.json(
      {
        assignment: result.assignment,
        operation: result.operation,
      },
      { status: result.operation === "created" ? 201 : 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
