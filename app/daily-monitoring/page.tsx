import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { getBusinessDateString } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";
import { getOfficerMonitoringData, listOfficerMonitoringLocations } from "@/lib/evaluating-officer-monitoring";
import { getPHIMonitoringData, listPhiAuthorizedLocations } from "@/lib/phi-attendance-monitoring";
import { EvaluatingOfficerDailyMonitoringClient } from "@/app/evaluating-officer/daily-monitoring/evaluating-officer-daily-monitoring-client";
import { PHIDailyMonitoringClient } from "@/app/phi/daily-monitoring/phi-daily-monitoring-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function DailyMonitoringPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { sessionUser, appUser } = await getAuthContext();
  const params = await searchParams;

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || (appUser.role !== "EVALUATING_OFFICER" && appUser.role !== "PHI")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-semibold text-white">Daily monitoring access only</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This monitoring area is restricted to Evaluating Officers and PHI users.
          </p>
        </div>
      </main>
    );
  }

  const selectedLocationId = firstString(params.locationId) ?? "";
  const selectedDate = getBusinessDateString();

  if (appUser.role === "EVALUATING_OFFICER") {
    let pageError: string | null = null;
    let monitoringData = {
      selectedDate,
      selectedLocationId,
      locations: [],
      location: null,
      tasks: [],
    } as Awaited<ReturnType<typeof getOfficerMonitoringData>>;

    try {
      monitoringData = await getOfficerMonitoringData(
        prisma,
        appUser.id,
        selectedLocationId,
        selectedDate,
      );
    } catch (error) {
      pageError =
        error instanceof Error ? error.message : "Unable to load the monitoring screen right now.";
    }

    const locations = await listOfficerMonitoringLocations(prisma, appUser.id, selectedDate);

    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                  Daily Monitoring
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                  Cleaning Evaluation
                </h1>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Signed in as {appUser.name}. Record daily cleaning evaluations for your assigned
                  locations.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/evaluating-officer"
                  className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Dashboard
                </Link>
                <Link
                  href="/evaluating-officer/history"
                  className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Evaluation History
                </Link>
              </div>
            </div>
          </header>

          {pageError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {pageError}
            </div>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                  Evaluating Officer
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Cleaning Evaluation</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select one of your assigned locations and evaluate the eligible cleaning tasks.
                </p>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                Evaluating Officer only
              </span>
            </div>
          </section>

          <EvaluatingOfficerDailyMonitoringClient
            key={`${monitoringData.selectedLocationId}:${monitoringData.selectedDate}:${monitoringData.tasks
              .map((task) => `${task.locationTaskId}:${task.result ?? ""}:${task.remark ?? ""}:${task.finalized ? "1" : "0"}`)
              .join("|")}`}
            initialData={monitoringData}
            assignedLocations={locations}
            currentFilters={{
              date: selectedDate,
              locationId: monitoringData.selectedLocationId,
            }}
          />
        </div>
      </main>
    );
  }

  let pageError: string | null = null;
  let monitoringData = {
    selectedDate,
    selectedLocationId,
    locations: [],
    location: null,
    totalWorkers: 0,
    totalPresentCount: null,
    remark: null,
    finalized: false,
    finalizedAt: null,
    lockedAt: null,
  } as Awaited<ReturnType<typeof getPHIMonitoringData>>;

  try {
    monitoringData = await getPHIMonitoringData(prisma, appUser.id, selectedLocationId, selectedDate);
  } catch (error) {
    pageError =
      error instanceof Error ? error.message : "Unable to load the monitoring screen right now.";
  }

  const locations = await listPhiAuthorizedLocations(prisma, appUser.id);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Daily Monitoring
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Attendance Evaluation</h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Signed in as {appUser.name}. Record a total-present count for one of your
                authorized locations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/phi"
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <Link
                href="/phi/attendance-history"
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Attendance History
              </Link>
            </div>
          </div>
        </header>

        {pageError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">PHI</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Attendance Evaluation</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select one authorized location, enter the total present count, and finalize when
                ready.
              </p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              PHI only
            </span>
          </div>
        </section>

        <PHIDailyMonitoringClient
          key={`${monitoringData.selectedLocationId}:${monitoringData.selectedDate}:${monitoringData.totalPresentCount ?? ""}:${monitoringData.remark ?? ""}:${monitoringData.finalized ? "1" : "0"}`}
          initialData={monitoringData}
          authorizedLocations={locations}
          currentFilters={{
            date: selectedDate,
            locationId: monitoringData.selectedLocationId,
          }}
        />
      </div>
    </main>
  );
}
