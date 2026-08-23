import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPhiMonthlyAttendanceReports } from "@/lib/phi-monthly-attendance";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export default async function AdministrationPhiMonthlyAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "ADMINISTRATION_OFFICER") {
    return <main className="p-8">Access denied.</main>;
  }

  const params = await searchParams;
  const month = Number(valueOf(params.month)) || undefined;
  const year = Number(valueOf(params.year)) || undefined;
  const page = Number(valueOf(params.page)) || 1;
  const data = await listPhiMonthlyAttendanceReports(
    prisma,
    { id: appUser.id, role: appUser.role },
    { month, year, page },
  );

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">Administration</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">PHI Monthly Attendance Review</h1>
          <p className="mt-2 text-sm text-slate-600">Review submitted monthly attendance deduction reports.</p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {["Period", "PHI", "Status", "Total", "Actions"].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <p className="font-semibold text-slate-900">No PHI monthly reports found.</p>
                    </td>
                  </tr>
                ) : (
                  data.reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">{dateLabel(report.year, report.month)}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{report.phiUser.name}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{report.status}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{report.grandTotal.toString()}</td>
                      <td className="px-5 py-4">
                        <Link href={`/administration/phi-monthly-attendance/${report.id}`} className="font-semibold text-cyan-700 hover:text-cyan-900">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
