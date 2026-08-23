import { NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";
import { generateMonthlyReportsForPeriod, getDefaultMonthlyGenerationOptions, MonthlyReportGenerationError } from "@/lib/monthly-report-generation";
import { prisma } from "@/lib/prisma";

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: error.status });
  if (error instanceof MonthlyReportGenerationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  return NextResponse.json({ error: "Unable to process monthly reports." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const { appUser } = await requireRole("GAA");
    const body = await request.json().catch(() => ({})) as { month?: unknown; year?: unknown };
    const fallback = getDefaultMonthlyGenerationOptions();
    const month = typeof body.month === "number" ? body.month : fallback.month;
    const year = typeof body.year === "number" ? body.year : fallback.year;
    const result = await generateMonthlyReportsForPeriod(prisma, { month, year, actorUserId: appUser.id });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
