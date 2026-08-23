import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decidePhiMonthlyAttendanceReport, PhiMonthlyAttendanceError } from "@/lib/phi-monthly-attendance";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof PhiMonthlyAttendanceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Unable to complete this review." }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { appUser } = await requireRole("ADMINISTRATION_OFFICER");
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const result = await decidePhiMonthlyAttendanceReport(
      prisma,
      { id: appUser.id, name: appUser.name, role: appUser.role, active: appUser.active },
      (await params).id,
      "APPROVE",
      typeof body.remarks === "string" ? body.remarks : undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
