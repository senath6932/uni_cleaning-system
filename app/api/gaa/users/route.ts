import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createManagedUser,
  listManagedUsers,
  type UserListFilters,
  assertAllowedRole,
  UserManagementError,
} from "@/lib/user-management";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof UserManagementError) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "AUTH_ERROR";
    return NextResponse.json(
      { error: error.message, code },
      { status: error.status },
    );
  }

  console.error("GAA users request failed", error);

  const detail =
    process.env.NODE_ENV !== "production" && error instanceof Error
      ? ` ${error.message}`
      : "";

  return NextResponse.json(
    { error: `An unexpected error occurred.${detail}` },
    { status: 500 },
  );
}

function parseQueryParams(searchParams: URLSearchParams): UserListFilters {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  return {
    query: searchParams.get("query") ?? undefined,
    role: searchParams.get("role") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    sortBy:
      sortBy === "name" ||
      sortBy === "email" ||
      sortBy === "role" ||
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
    const result = await listManagedUsers(prisma, parseQueryParams(url.searchParams));
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
    const email = typeof body.email === "string" ? body.email : "";
    const role = typeof body.role === "string" ? body.role : "";
    const active = typeof body.active === "boolean" ? body.active : true;
    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirmation =
      typeof body.passwordConfirmation === "string" ? body.passwordConfirmation : "";
    assertAllowedRole(role);

    const result = await createManagedUser(
      prisma,
      { id: appUser.id, name: appUser.name },
      { name, email, role, active, password, passwordConfirmation },
    );

    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          active: result.user.active,
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
