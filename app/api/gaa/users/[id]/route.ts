import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  type UpdateUserInput,
  deactivateManagedUser,
  deleteManagedUser,
  updateManagedUser,
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

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") {
      return NextResponse.json(
        { error: "This user is referenced by existing records and cannot be permanently deleted. Deactivate the user instead.", code },
        { status: 409 },
      );
    }
    if (code === "P2025") {
      return NextResponse.json(
        { error: "The user was already removed from the database.", code },
        { status: 404 },
      );
    }
    if (code === "P2014") {
      return NextResponse.json(
        { error: "This user is still linked to other database records. Deactivate the user instead.", code },
        { status: 409 },
      );
    }
  }

  console.error("GAA user mutation failed", error);

  const detail =
    process.env.NODE_ENV !== "production" && error instanceof Error
      ? ` ${error.message}`
      : "";

  return NextResponse.json(
    { error: `Unable to complete the user deletion.${detail}` },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/gaa/users/[id]">,
) {
  try {
    const { appUser } = await requireRole("GAA");
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const input: UpdateUserInput = {};

    if (typeof body.name === "string") {
      input.name = body.name;
    }

    if (
      body.role === "GAA" ||
      body.role === "EVALUATING_OFFICER" ||
      body.role === "PHI" ||
      body.role === "ADMINISTRATION_OFFICER" ||
      body.role === "VICE_CHANCELLOR"
    ) {
      input.role = body.role;
    }

    if (typeof body.active === "boolean") {
      input.active = body.active;
    }

    if (body.active === false) {
      const result = await deactivateManagedUser(
        prisma,
        { id: appUser.id, name: appUser.name },
        id,
      );

      return NextResponse.json({
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          active: result.user.active,
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
      });
    }

    const result = await updateManagedUser(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
      input,
    );

    return NextResponse.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        active: result.user.active,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/gaa/users/[id]">,
) {
  try {
    const { appUser } = await requireRole("GAA");
    const { id } = await context.params;
    const result = await deleteManagedUser(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
    );

    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createSupabaseAdminClient();
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        console.error("Database user deleted but Supabase Auth deletion failed", error);
        return NextResponse.json(
          {
            deleted: true,
            userId: result.user.id,
            warning: "The database user was deleted, but the Supabase Auth account could not be removed. Remove the Auth account from Supabase Dashboard.",
          },
          { status: 200 },
        );
      }
    } catch (error) {
      console.error("Database user deleted but Supabase Auth deletion failed", error);
      return NextResponse.json(
        {
          deleted: true,
          userId: result.user.id,
          warning: "The database user was deleted, but the Supabase Auth account could not be removed. Remove the Auth account from Supabase Dashboard.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ deleted: true, userId: result.user.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}
