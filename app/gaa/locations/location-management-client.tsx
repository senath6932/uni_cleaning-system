"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  LocationListItem,
  LocationListResult,
} from "@/lib/location-management";

type Props = {
  initialData: LocationListResult;
  currentFilters: {
    query: string;
    status: string;
    page: number;
    pageSize: number;
  };
};

type DraftLocation = {
  id?: string;
  code: string;
  name: string;
  minimumWorkers: string;
  active: boolean;
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMinimumWorkers(value: number | null) {
  return value === null ? "Not set" : String(value);
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function GaaLocationManagementClient({ initialData, currentFilters }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationListItem | null>(null);
  const [draft, setDraft] = useState<DraftLocation>({
    code: "",
    name: "",
    minimumWorkers: "",
    active: true,
  });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [tableBusyId, setTableBusyId] = useState<string | null>(null);

  const activeCount = initialData.locations.filter((location) => location.active).length;
  const inactiveCount = initialData.locations.length - activeCount;

  const openCreateModal = () => {
    setEditingLocation(null);
    setDraft({
      code: "",
      name: "",
      minimumWorkers: "",
      active: true,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const openEditModal = (location: LocationListItem) => {
    setEditingLocation(location);
    setDraft({
      id: location.id,
      code: location.code,
      name: location.name,
      minimumWorkers: location.minimumWorkers === null ? "" : String(location.minimumWorkers),
      active: location.active,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const refresh = () => router.refresh();

  const submitLocation = async () => {
    setFeedback(null);

    const payload = {
      code: draft.code,
      name: draft.name,
      minimumWorkers: draft.minimumWorkers,
      active: draft.active,
    };

    const endpoint = editingLocation ? `/api/gaa/locations/${editingLocation.id}` : "/api/gaa/locations";
    const method = editingLocation ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setFeedback({
        kind: "error",
        text: json.error ?? "Unable to save the location.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: editingLocation ? "Location updated successfully." : "Location created successfully.",
    });
    setModalOpen(false);
    refresh();
  };

  const toggleActive = async (location: LocationListItem) => {
    const shouldDeactivate = location.active;
    const confirmed = window.confirm(
      shouldDeactivate
        ? "Deactivate this location?\n\nThe location will no longer be active for new operational use.\nHistorical records will be preserved."
        : "Activate this location again?",
    );

    if (!confirmed) {
      return;
    }

    setTableBusyId(location.id);
    setFeedback(null);

    const response = await fetch(`/api/gaa/locations/${location.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !location.active }),
    });

    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setTableBusyId(null);

    if (!response.ok) {
      setFeedback({
        kind: "error",
        text: json.error ?? "Unable to update the location.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: location.active ? "Location deactivated." : "Location activated.",
    });
    refresh();
  };

  const deleteLocation = async (location: LocationListItem) => {
    const confirmed = window.confirm(
      `Permanently delete ${location.code} - ${location.name} from the database? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setTableBusyId(location.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/gaa/locations/${location.id}`, {
        method: "DELETE",
      });

      const json = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setFeedback({
          kind: "error",
          text: json.error ?? "Unable to delete the location.",
        });
        return;
      }

      setFeedback({
        kind: "success",
        text: "Location deleted from the database.",
      });
      refresh();
    } catch {
      setFeedback({
        kind: "error",
        text: "The location could not be deleted. Check the server connection and try again.",
      });
    } finally {
      setTableBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Locations</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{initialData.total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activeCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Inactive</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{inactiveCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Filtered Results</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{initialData.locations.length}</p>
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
            <h2 className="text-xl font-semibold text-slate-900">Location directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure active and inactive campus locations for operational use.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Add Location
          </button>
        </div>

        <form method="get" action="/gaa/locations" className="mt-6 grid gap-3 md:grid-cols-2">
          <input
            name="query"
            defaultValue={currentFilters.query}
            placeholder="Search code or name"
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          />
          <select
            name="status"
            defaultValue={currentFilters.status}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={currentFilters.pageSize} />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 md:col-span-2"
          >
            Apply Filters
          </button>
        </form>

        <div className="mt-6 space-y-4 md:hidden">
          {initialData.locations.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              No locations match the current filters.
            </div>
          ) : (
            initialData.locations.map((location) => (
              <article
                key={location.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{location.code}</p>
                    <p className="mt-1 text-sm text-slate-600">{location.name}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      location.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {location.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Min Workers</p>
                    <p className="mt-1">{formatMinimumWorkers(location.minimumWorkers)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Created</p>
                    <p className="mt-1">{formatDate(location.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(location)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={tableBusyId === location.id}
                    onClick={() => {
                      void toggleActive(location);
                    }}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {tableBusyId === location.id
                      ? "Saving..."
                      : location.active
                        ? "Deactivate"
                        : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={tableBusyId === location.id}
                    onClick={() => {
                      void deleteLocation(location);
                    }}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete Permanently
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-3xl border border-slate-200 md:block">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Min Workers
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {initialData.locations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    No locations match the current filters.
                  </td>
                </tr>
              ) : (
                initialData.locations.map((location) => (
                  <tr key={location.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">
                      {location.code}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{location.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatMinimumWorkers(location.minimumWorkers)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          location.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {location.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatDate(location.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(location)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={tableBusyId === location.id}
                          onClick={() => {
                            void toggleActive(location);
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {tableBusyId === location.id
                            ? "Saving..."
                            : location.active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={tableBusyId === location.id}
                          onClick={() => {
                            void deleteLocation(location);
                          }}
                          className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete Permanently
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            Showing {initialData.locations.length} of {initialData.total} locations
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/gaa/locations${buildQueryString({
                ...currentFilters,
                page: Math.max(1, currentFilters.page - 1),
              })}`}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Previous
            </Link>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              Page {initialData.page} of {initialData.totalPages}
            </span>
            <Link
              href={`/gaa/locations${buildQueryString({
                ...currentFilters,
                page: Math.min(initialData.totalPages, currentFilters.page + 1),
              })}`}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Next
            </Link>
          </div>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {editingLocation ? "Edit Location" : "Add Location"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingLocation
                    ? "Update the code, name, minimum workers, or active status."
                    : "Create a new location for university operations."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Location Code</span>
                <input
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, code: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  placeholder="SCI-BLOCK"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Location Name</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  placeholder="Science Block"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Minimum Workers</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.minimumWorkers}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, minimumWorkers: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  placeholder="Optional"
                />
                <p className="text-xs text-slate-500">Leave blank if no minimum is configured.</p>
              </label>

              <label className="flex items-end gap-3 rounded-2xl border border-slate-300 px-4 py-3">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, active: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(() => {
                    void submitLocation();
                  });
                }}
                className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : editingLocation ? "Update Location" : "Create Location"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
