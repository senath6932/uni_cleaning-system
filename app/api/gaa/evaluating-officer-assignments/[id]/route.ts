import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  activateManagedEvaluatingOfficerAssignment,
  deactivateManagedEvaluatingOfficerAssignment,
  getManagedEvaluatingOfficerAssignmentById,
  EvaluatingOfficerAssignmentError,
  type UpdateEvaluatingOfficerAssignmentInput,
  updateManagedEvaluatingOfficerAssignment,
} from "@/lib/evaluating-officer-assignments";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof EvaluatingOfficerAssignmentError) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "AUTH_ERROR";
    return NextResponse.json({ error: error.message, code }, { status: error.status });
  }

  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("GAA");
    const { id } = await context.params;
    const assignment = await getManagedEvaluatingOfficerAssignmentById(prisma, id);

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found.", code: "ASSIGNMENT_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ assignment });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { appUser } = await requireRole("GAA");
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const input: UpdateEvaluatingOfficerAssignmentInput = {};

    if (typeof body.active === "boolean") {
      input.active = body.active;
    }

    if (typeof body.active === "boolean" && Object.keys(input).length === 1) {
      const result = body.active
        ? await activateManagedEvaluatingOfficerAssignment(
            prisma,
            { id: appUser.id, name: appUser.name },
            id,
          )
        : await deactivateManagedEvaluatingOfficerAssignment(
            prisma,
            { id: appUser.id, name: appUser.name },
            id,
          );

      return NextResponse.json({ assignment: result.assignment });
    }

    const result = await updateManagedEvaluatingOfficerAssignment(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
      input,
    );

    return NextResponse.json({ assignment: result.assignment });
  } catch (error) {
    return toErrorResponse(error);
  }
}
