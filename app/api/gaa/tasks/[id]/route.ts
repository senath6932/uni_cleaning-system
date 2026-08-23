import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getManagedTaskById,
  type UpdateCleaningTaskInput,
  updateManagedTask,
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("GAA");
    const { id } = await context.params;
    const task = await getManagedTaskById(prisma, id);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found.", code: "TASK_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ task });
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

    const input: UpdateCleaningTaskInput = {};

    if (typeof body.name === "string") {
      input.name = body.name;
    }

    if (typeof body.frequency === "string") {
      input.frequency = body.frequency;
    }

    if (typeof body.active === "boolean") {
      input.active = body.active;
    }

    const result = await updateManagedTask(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
      input,
    );

    return NextResponse.json({
      task: result.task,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
