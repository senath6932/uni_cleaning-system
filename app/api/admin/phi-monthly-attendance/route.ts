import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PhiMonthlyAttendanceError, listPhiMonthlyAttendanceReports } from "@/lib/phi-monthly-attendance";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof PhiMonthlyAttendanceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Unable to load PHI monthly attendance reports." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { appUser } = await requireRole("ADMINISTRATION_OFFICER");
    const url = new URL(request.url);
    const month = Number(url.searchParams.get("month") ?? "");
    const year = Number(url.searchParams.get("year") ?? "");
    const page = Number(url.searchParams.get("page") ?? "");
    const data = await listPhiMonthlyAttendanceReports(prisma, { id: appUser.id, role: appUser.role }, { month: Number.isFinite(month) ? month : undefined, year: Number.isFinite(year) ? year : undefined, page: Number.isFinite(page) ? page : undefined });
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
