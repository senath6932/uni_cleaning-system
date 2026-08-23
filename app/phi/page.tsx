import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AppShell } from "@/app/_components/app-shell";
import { prisma } from "@/lib/prisma";
import { getPHIDashboardData } from "@/lib/role-dashboards";

export default async function PhiPage() {
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
            This dashboard is restricted to assigned PHIs.
          </p>
        </div>
      </main>
    );
  }

  const dashboardData = await getPHIDashboardData(prisma, appUser.id);
  const authorizedLocations = dashboardData.authorizedLocations;

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                PHI Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Daily attendance monitoring
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Signed in as {appUser.name}. Record location-level attendance counts for your
                authorized locations, then review the history from the same workspace.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/daily-monitoring"
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open Monitoring
              </Link>
              <Link
                href="/phi/attendance-history"
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Attendance History
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Authorized locations</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{authorizedLocations.length}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Today&apos;s Attendance Entries</p><p className="mt-2 text-3xl font-semibold text-slate-950">{dashboardData.todayEntries}</p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Today&apos;s Total Present</p><p className="mt-2 text-3xl font-semibold text-slate-950">{dashboardData.todayTotal}</p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Current Month Entries</p><p className="mt-2 text-3xl font-semibold text-slate-950">{dashboardData.currentMonthEntries}</p></article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Authorized locations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Use the daily monitoring page to record the total present count and a remark for a
                selected location.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {authorizedLocations.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No active PHI assignments were found for your account.
              </div>
            ) : (
              authorizedLocations.map((location) => (
                <article
                  key={location.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{location.code}</p>
                      <p className="mt-1 text-sm text-slate-600">{location.name}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        location.active && location.assignmentActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {location.active && location.assignmentActive ? "Active" : "Review"}
                    </span>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                    Record one location-level total present count from daily monitoring.
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
