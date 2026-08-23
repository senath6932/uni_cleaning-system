import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PhiMonthlyAttendanceError,
  getPhiMonthlyAttendanceReportForPeriod,
  savePhiMonthlyAttendanceReport,
} from "@/lib/phi-monthly-attendance";

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof PhiMonthlyAttendanceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: "Unable to process PHI monthly attendance." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { appUser } = await requireRole("PHI");
    const url = new URL(request.url);
    const month = Number(url.searchParams.get("month") ?? "");
    const year = Number(url.searchParams.get("year") ?? "");
    const report = await getPhiMonthlyAttendanceReportForPeriod(
      prisma,
      { id: appUser.id, role: appUser.role, active: appUser.active },
      month,
      year,
    );

    return NextResponse.json({ report });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { appUser } = await requireRole("PHI");
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const report = await savePhiMonthlyAttendanceReport(
      prisma,
      {
        id: appUser.id,
        name: appUser.name,
        role: appUser.role,
        active: appUser.active,
      },
      {
        month: body.month,
        year: body.year,
        action: body.action === "submit" ? "submit" : "save",
        rows: Array.isArray(body.rows)
          ? body.rows.map((row) => ({
              category: row && typeof row === "object" && typeof (row as Record<string, unknown>).category === "string"
                ? (row as Record<string, unknown>).category
                : "",
              employeeCount: row && typeof row === "object" ? (row as Record<string, unknown>).employeeCount : undefined,
              deductionRate: row && typeof row === "object" ? (row as Record<string, unknown>).deductionRate : undefined,
            }))
          : [],
      },
    );

    return NextResponse.json({ report });
  } catch (error) {
    return toErrorResponse(error);
  }
}
