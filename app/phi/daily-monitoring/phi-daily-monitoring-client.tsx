"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PHIAuthorizedLocation, PHIMonitoringData } from "@/lib/phi-attendance-monitoring";

type Props = {
  initialData: PHIMonitoringData;
  authorizedLocations: PHIAuthorizedLocation[];
  currentFilters: {
    date: string;
    locationId: string;
  };
};

type Draft = {
  totalPresentCount: string;
  remark: string;
};

export function PHIDailyMonitoringClient({ initialData, authorizedLocations, currentFilters }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    totalPresentCount: initialData.totalPresentCount?.toString() ?? "",
    remark: initialData.remark ?? "",
  });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const selectedLocation = useMemo(
    () => authorizedLocations.find((location) => location.id === initialData.selectedLocationId) ?? null,
    [authorizedLocations, initialData.selectedLocationId],
  );

  const submit = async (finalize: boolean) => {
    setFeedback(null);
    const response = await fetch("/api/phi/daily-monitoring", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationId: initialData.selectedLocationId,
        attendanceDate: initialData.selectedDate,
        totalPresentCount: draft.totalPresentCount,
        remark: draft.remark,
        finalize,
      }),
    });

    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setFeedback({
        kind: "error",
        text: json.error ?? "Unable to save the attendance record.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: finalize ? "Attendance finalized successfully." : "Attendance saved successfully.",
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Authorized Locations</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{authorizedLocations.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Selected Location</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {selectedLocation ? selectedLocation.code : "None"}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Date</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{initialData.selectedDate}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Linked workers</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{initialData.totalWorkers}</p>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Attendance evaluation</h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit one total-present count for the selected location and date.
            </p>
          </div>
        </div>

        <form
          method="get"
          action="/phi/daily-monitoring"
          className="mt-6 grid gap-3 md:grid-cols-3"
        >
          <select
            name="locationId"
            defaultValue={currentFilters.locationId}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">Select Location</option>
            {authorizedLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="date"
            defaultValue={currentFilters.date}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Load Location
          </button>
        </form>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Total present count</span>
            <input
              type="number"
              min={0}
              value={draft.totalPresentCount}
              disabled={!initialData.selectedLocationId || initialData.finalized}
              onChange={(event) =>
                setDraft((current) => ({ ...current, totalPresentCount: event.target.value }))
              }
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Remark</span>
            <textarea
              value={draft.remark}
              disabled={!initialData.selectedLocationId || initialData.finalized}
              onChange={(event) =>
                setDraft((current) => ({ ...current, remark: event.target.value }))
              }
              rows={4}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/phi/attendance-history"
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View History
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || !initialData.selectedLocationId || initialData.finalized}
              onClick={() => {
                startTransition(() => {
                  void submit(false);
                });
              }}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              disabled={isPending || !initialData.selectedLocationId || initialData.finalized}
              onClick={() => {
                startTransition(() => {
                  void submit(true);
                });
              }}
              className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Finalize
            </button>
          </div>
        </div>

        {initialData.finalized ? (
          <p className="mt-4 text-sm text-slate-500">
            This attendance record is finalized and cannot be changed.
          </p>
        ) : null}
      </section>
    </div>
  );
}
