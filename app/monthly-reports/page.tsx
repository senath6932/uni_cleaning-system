import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listMonthlyReportReferenceData, listMonthlyReports } from "@/lib/monthly-reports";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const roles = ["GAA", "ADMINISTRATION_OFFICER", "EVALUATING_OFFICER", "PHI", "VICE_CHANCELLOR"] as const;
function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function dateLabel(year: number, month: number) { return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function formatDate(date: Date | null) { return date ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "-"; }

export default async function MonthlyReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { sessionUser, appUser } = await getAuthContext();
  if (!sessionUser) redirect("/login");
  if (!appUser || !roles.includes(appUser.role as (typeof roles)[number])) return <main className="p-8">You do not have permission to view monthly reports.</main>;
  const params = await searchParams;
  const month = Number(valueOf(params.month)) || undefined;
  const year = Number(valueOf(params.year)) || undefined;
  const page = Number(valueOf(params.page)) || 1;
  const filters = { query: valueOf(params.query), month, year, locationId: valueOf(params.locationId), status: valueOf(params.status), page };
  let data;
  let locations;
  const access = { userId: appUser.id, role: appUser.role };
  try { [data, locations] = await Promise.all([listMonthlyReports(prisma, access, filters), listMonthlyReportReferenceData(prisma, access)]); }
  catch { return <AppShell user={appUser}><div className="rounded-3xl border border-red-200 bg-red-50 p-8"><h1 className="text-2xl font-semibold text-red-950">Unable to load monthly reports.</h1><p className="mt-2 text-sm text-red-800">Please try again.</p></div></AppShell>; }
  const years = Array.from(new Set(data.reports.map((report) => report.year))).sort((a, b) => b - a);
  return <AppShell user={appUser}>
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header><p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">Reporting</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">Monthly Reports</h1><p className="mt-2 text-sm text-slate-600">View automatically generated monthly cleaning monitoring reports.</p></header>
      <form className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5" method="get">
        <label className="lg:col-span-2"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span><input name="query" defaultValue={valueOf(params.query)} placeholder="Search location..." className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900" /></label>
        <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Month</span><select name="month" defaultValue={month ?? ""} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All months</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(Date.UTC(2020, i, 1)))}</option>)}</select></label>
        <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Year</span><select name="year" defaultValue={year ?? ""} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Location</span><select name="locationId" defaultValue={valueOf(params.locationId) ?? ""} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} - {location.name}</option>)}</select></label>
        <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span><select name="status" defaultValue={valueOf(params.status) ?? ""} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All statuses</option>{["DRAFT", "SUBMITTED", "RESUBMITTED", "CORRECTION_REQUESTED", "ADMIN_APPROVED", "ADMIN_REJECTED", "VC_PENDING", "VC_APPROVED", "VC_REJECTED", "CLARIFICATION_REQUESTED"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <div className="flex items-end"><button className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700" type="submit">Apply filters</button></div>
      </form>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{["Reporting Month", "Location", "Status", "Generated", "Submitted", "Actions"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{data.reports.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center"><p className="font-semibold text-slate-900">No monthly reports found.</p><p className="mt-1 text-sm text-slate-500">There are no generated monthly reports matching your filters.</p></td></tr> : data.reports.map((report) => <tr key={report.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">{dateLabel(report.year, report.month)}</td><td className="px-5 py-4 text-sm text-slate-700"><span className="font-medium">{report.location.code}</span><span className="block text-slate-500">{report.location.name}</span></td><td className="px-5 py-4"><span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">{report.status}</span></td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{formatDate(report.generatedAt)}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{formatDate(report.submittedAt)}</td><td className="px-5 py-4"><Link href={`/monthly-reports/${report.id}`} className="font-semibold text-cyan-700 hover:text-cyan-900">View report</Link></td></tr>)}</tbody></table></div>{data.totalPages > 1 ? <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm"><span className="text-slate-500">Page {data.page} of {data.totalPages}</span><div className="flex gap-2">{data.page > 1 ? <Link className="rounded-xl border px-3 py-2" href={{ query: { ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, valueOf(value) ?? ""])), page: String(data.page - 1) } }}>Previous</Link> : null}{data.page < data.totalPages ? <Link className="rounded-xl border px-3 py-2" href={{ query: { ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, valueOf(value) ?? ""])), page: String(data.page + 1) } }}>Next</Link> : null}</div></div> : null}</section>
    </div>
  </AppShell>;
}
