import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPhiMonthlyAttendanceReport } from "@/lib/phi-monthly-attendance";
import { ReviewActions } from "../review-actions";

function money(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "-";
  if (parsed === 0) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
}

function dateLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function serializeReport(report: NonNullable<Awaited<ReturnType<typeof getPhiMonthlyAttendanceReport>>>) {
  return {
    ...report,
    grandTotal: report.grandTotal.toString(),
    rows: report.rows.map((row) => ({
      ...row,
      deductionRate: row.deductionRate.toString(),
      rowTotal: row.rowTotal.toString(),
    })),
  };
}

export default async function AdministrationPhiMonthlyAttendanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "ADMINISTRATION_OFFICER") {
    return <main className="p-8">Access denied.</main>;
  }

  const { id } = await params;
  const report = await getPhiMonthlyAttendanceReport(prisma, { id: appUser.id, role: appUser.role }, id);
  if (!report) notFound();
  const data = serializeReport(report);

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/administration/phi-monthly-attendance" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
            &larr; Back to review list
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Administration Review</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                PHI Monthly Attendance - {dateLabel(data.year, data.month)}
              </h1>
              <p className="mt-2 text-sm text-slate-600">PHI: {data.phiUser.name}</p>
            </div>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">{data.status}</span>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employees</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">{row.category}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{row.employeeCount}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{money(row.deductionRate)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">{row.rowTotal === "0" ? "-" : money(row.rowTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-950" colSpan={3}>Total Amount</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-950">{money(data.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <ReviewActions reportId={data.id} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
