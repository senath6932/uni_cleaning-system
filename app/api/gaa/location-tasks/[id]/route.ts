import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  activateManagedLocationTask,
  deactivateManagedLocationTask,
  getManagedLocationTaskById,
  LocationTaskManagementError,
  type UpdateLocationTaskInput,
  updateManagedLocationTask,
} from "@/lib/location-task-management";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof LocationTaskManagementError) {
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
    const locationTask = await getManagedLocationTaskById(prisma, id);

    if (!locationTask) {
      return NextResponse.json(
        { error: "Location task assignment not found.", code: "LOCATION_TASK_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ locationTask });
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

    const input: UpdateLocationTaskInput = {};

    if (body.allocatedAmount !== undefined) {
      input.allocatedAmount = body.allocatedAmount;
    }

    if (typeof body.active === "boolean") {
      input.active = body.active;
    }

    if (typeof body.active === "boolean" && Object.keys(input).length === 1) {
      const result = body.active
        ? await activateManagedLocationTask(prisma, { id: appUser.id, name: appUser.name }, id)
        : await deactivateManagedLocationTask(
            prisma,
            { id: appUser.id, name: appUser.name },
            id,
          );

      return NextResponse.json({ locationTask: result.locationTask });
    }

    const result = await updateManagedLocationTask(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
      input,
    );

    return NextResponse.json({ locationTask: result.locationTask });
  } catch (error) {
    return toErrorResponse(error);
  }
}
