import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessDateString } from "@/lib/business-date";
import {
  PHI_MONTHLY_ATTENDANCE_CATEGORIES,
  getPhiMonthlyAttendanceReportForPeriod,
} from "@/lib/phi-monthly-attendance";
import { PhiMonthlyAttendanceClient } from "./phi-monthly-attendance-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function serializeReport(report: NonNullable<Awaited<ReturnType<typeof getPhiMonthlyAttendanceReportForPeriod>>>) {
  return {
    id: report.id,
    month: report.month,
    year: report.year,
    status: report.status,
    processingError: report.processingError,
    grandTotal: report.grandTotal.toString(),
    generatedAt: report.generatedAt?.toISOString() ?? null,
    submittedAt: report.submittedAt?.toISOString() ?? null,
    resubmittedAt: report.resubmittedAt?.toISOString() ?? null,
    finalizedAt: report.finalizedAt?.toISOString() ?? null,
    rows: report.rows.map((row) => ({
      id: row.id,
      category: row.category,
      employeeCount: row.employeeCount,
      deductionRate: row.deductionRate.toString(),
      rowTotal: row.rowTotal.toString(),
    })),
  };
}

export default async function PhiMonthlyAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "PHI") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-semibold text-white">PHI access only</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This page is restricted to assigned PHIs.
          </p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const today = getBusinessDateString();
  const defaultMonth = Number(today.slice(5, 7));
  const defaultYear = Number(today.slice(0, 4));
  const month = Number(valueOf(params.month)) || defaultMonth;
  const year = Number(valueOf(params.year)) || defaultYear;
  const report = await getPhiMonthlyAttendanceReportForPeriod(prisma, { id: appUser.id, role: appUser.role }, month, year);
  const initialReport = report ? serializeReport(report) : null;

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                PHI
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Monthly Attendance Report
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Enter the six monthly attendance categories used to prepare the official
                deduction report. The server recalculates every total before saving.
              </p>
            </div>
            <Link
              href={report ? `/phi/monthly-attendance/${report.id}` : "#"}
              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${
                report ? "bg-slate-900 text-white hover:bg-slate-800" : "pointer-events-none bg-slate-200 text-slate-500"
              }`}
            >
              Preview Saved Report
            </Link>
          </div>
        </header>

        <PhiMonthlyAttendanceClient
          key={report?.id ?? `${month}-${year}`}
          month={month}
          year={year}
          initialReport={initialReport}
          categories={PHI_MONTHLY_ATTENDANCE_CATEGORIES}
        />
      </div>
    </AppShell>
  );
}
