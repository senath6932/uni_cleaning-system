import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { AppShell } from "@/app/_components/app-shell";
import { prisma } from "@/lib/prisma";
import { getGAADashboardData } from "@/lib/role-dashboards";

export default async function GaaPage() {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "GAA") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
            Access denied
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">GAA access only</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Your authenticated account does not have the GAA role.
          </p>
        </div>
      </main>
    );
  }

  const [dashboardData, totalUsers] = await Promise.all([
    getGAADashboardData(prisma),
    prisma.user.count(),
  ]);

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                GAA Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                University Cleaning Service Management
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Welcome, {appUser.name}. Manage the cleaning service configuration and review generated monthly reports.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Users", value: totalUsers },
            { label: "Total Locations", value: dashboardData.locations },
            { label: "Active Tasks", value: dashboardData.activeTasks },
            { label: "Monthly Reports", value: dashboardData.monthlyReports },
          ].map((item) => (
            <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/gaa/users"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-950">Users</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create, edit, activate, and deactivate application users.
            </p>
          </Link>
          <Link
            href="/gaa/locations"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-950">Locations</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              View, search, create, edit, activate, and deactivate locations.
            </p>
          </Link>
          <Link
            href="/gaa/tasks"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-950">Cleaning Tasks</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Configure reusable global cleaning task definitions.
            </p>
          </Link>
          <Link
            href="/gaa/location-tasks"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-950">Location Assignments</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Assign cleaning tasks to active locations and set allocated amounts.
            </p>
          </Link>
          <Link
            href="/gaa/evaluating-officer-assignments"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-950">Officer Assignments</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Assign active evaluating officers to active locations.
            </p>
          </Link>
          <Link
            href="/monthly-reports"
            className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm transition hover:bg-cyan-100"
          >
            <p className="text-sm font-semibold text-slate-950">Monthly Reports</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              View generated cleaning monitoring reports.
            </p>
          </Link>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">System Notes</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Monthly processing and finance workflows remain available only where already
              implemented.
            </p>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Recent Activity</h2>
          <div className="mt-5 space-y-3">
            {dashboardData.activity.length === 0 ? <p className="text-sm text-slate-500">No recent activity.</p> : dashboardData.activity.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{item.description ?? item.action}</p>
                <p className="mt-1 text-xs text-slate-500">{item.user.name}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
