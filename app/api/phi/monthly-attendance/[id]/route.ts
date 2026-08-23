import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPhiMonthlyAttendanceReport, PhiMonthlyAttendanceError } from "@/lib/phi-monthly-attendance";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof PhiMonthlyAttendanceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Unable to load the report." }, { status: 500 });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { appUser } = await requireRole("PHI");
    const report = await getPhiMonthlyAttendanceReport(prisma, { id: appUser.id, role: appUser.role }, (await params).id);
    return NextResponse.json({ report });
  } catch (error) {
    return toErrorResponse(error);
  }
}
