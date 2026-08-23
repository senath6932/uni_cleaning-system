import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createManagedLocation,
  listManagedLocations,
  type LocationListFilters,
  LocationManagementError,
} from "@/lib/location-management";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof LocationManagementError) {
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

function parseQueryParams(searchParams: URLSearchParams): LocationListFilters {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  return {
    query: searchParams.get("query") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    sortBy:
      sortBy === "code" ||
      sortBy === "name" ||
      sortBy === "minimumWorkers" ||
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
    const result = await listManagedLocations(prisma, parseQueryParams(url.searchParams));
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { appUser } = await requireRole("GAA");
    const body = (await request.json()) as Record<string, unknown>;

    const code = typeof body.code === "string" ? body.code : "";
    const name = typeof body.name === "string" ? body.name : "";
    const active = typeof body.active === "boolean" ? body.active : true;

    const result = await createManagedLocation(
      prisma,
      { id: appUser.id, name: appUser.name },
      {
        code,
        name,
        minimumWorkers: body.minimumWorkers,
        active,
      },
    );

    return NextResponse.json(
      {
        location: result.location,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
