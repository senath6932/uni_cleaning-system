import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPhiMonthlyAttendanceReport } from "@/lib/phi-monthly-attendance";
import { PrintReportButton } from "../print-report-button";

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

export default async function PhiMonthlyAttendanceReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || !["PHI", "GAA", "ADMINISTRATION_OFFICER", "VICE_CHANCELLOR"].includes(appUser.role)) {
    return <main className="p-8">You do not have permission to view this report.</main>;
  }

  const { id } = await params;
  const report = await getPhiMonthlyAttendanceReport(prisma, { id: appUser.id, role: appUser.role }, id);
  if (!report) notFound();
  const data = serializeReport(report);

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 print-report">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/phi/monthly-attendance" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
            &larr; Back to Monthly Attendance
          </Link>
          <PrintReportButton />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
            University Cleaning Monitoring System
          </p>
          <div className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">Attendance Report - {dateLabel(data.year, data.month)}</h1>
              <p className="mt-2 text-sm text-slate-600">Official PHI monthly attendance deduction report.</p>
            </div>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">{data.status}</span>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">No. of Employees</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Deduction Rate per Person</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">
                      {row.category.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{row.employeeCount}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{money(row.deductionRate)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                      {row.rowTotal === "0" ? "-" : money(row.rowTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-950" colSpan={3}>
                    Total Amount
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-950">{money(data.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="PHI" value={data.phiUser.name} />
            <Info label="Generated" value={data.generatedAt ? new Intl.DateTimeFormat("en-GB").format(new Date(data.generatedAt)) : "-"} />
            <Info label="Submitted" value={data.submittedAt ? new Intl.DateTimeFormat("en-GB").format(new Date(data.submittedAt)) : "-"} />
            <Info label="Finalized" value={data.finalizedAt ? new Intl.DateTimeFormat("en-GB").format(new Date(data.finalizedAt)) : "-"} />
          </dl>

          {data.processingError ? (
            <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{data.processingError}</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{value}</dd>
    </div>
  );
}
