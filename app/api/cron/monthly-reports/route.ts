import { NextResponse } from "next/server";
import { generateMonthlyReportsForPeriod, getDefaultMonthlyGenerationOptions, MonthlyReportGenerationError } from "@/lib/monthly-report-generation";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const secret = process.env.MONTHLY_REPORT_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const period = getDefaultMonthlyGenerationOptions();
    const result = await generateMonthlyReportsForPeriod(prisma, period);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MonthlyReportGenerationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to process monthly reports." }, { status: 500 });
  }
}
