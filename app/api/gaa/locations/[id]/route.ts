import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getManagedLocationById,
  type UpdateLocationInput,
  deleteManagedLocation,
  updateManagedLocation,
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("GAA");
    const { id } = await context.params;
    const location = await getManagedLocationById(prisma, id);

    if (!location) {
      return NextResponse.json(
        { error: "Location not found.", code: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ location });
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

    const input: UpdateLocationInput = {};

    if (typeof body.code === "string") {
      input.code = body.code;
    }

    if (typeof body.name === "string") {
      input.name = body.name;
    }

    if ("minimumWorkers" in body) {
      input.minimumWorkers = body.minimumWorkers;
    }

    if (typeof body.active === "boolean") {
      input.active = body.active;
    }

    const result = await updateManagedLocation(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
      input,
    );

    return NextResponse.json({
      location: result.location,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { appUser } = await requireRole("GAA");
    const { id } = await context.params;
    const result = await deleteManagedLocation(
      prisma,
      { id: appUser.id, name: appUser.name },
      id,
    );

    return NextResponse.json({
      deleted: true,
      locationId: result.location.id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
