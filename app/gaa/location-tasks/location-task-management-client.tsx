"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  LocationTaskListItem,
  LocationTaskListResult,
  LocationTaskReferenceData,
} from "@/lib/location-task-management";

type Props = {
  initialData: LocationTaskListResult;
  referenceData: LocationTaskReferenceData;
  currentFilters: {
    query: string;
    locationId: string;
    taskId: string;
    status: string;
    page: number;
    pageSize: number;
    sortBy: "createdAt" | "allocatedAmount" | "active";
    sortOrder: "asc" | "desc";
  };
  pageError: string | null;
};

type DraftLocationTask = {
  id?: string;
  locationId: string;
  taskId: string;
  allocatedAmount: string;
  active: boolean;
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAmount(value: string) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return `Rs. ${value}`;
  }

  return `Rs. ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue)}`;
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

export function GaaLocationTaskManagementClient({
  initialData,
  referenceData,
  currentFilters,
  pageError,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LocationTaskListItem | null>(null);
  const [draft, setDraft] = useState<DraftLocationTask>({
    locationId: "",
    taskId: "",
    allocatedAmount: "",
    active: true,
  });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [tableBusyId, setTableBusyId] = useState<string | null>(null);

  const activeLocations = useMemo(
    () => referenceData.locations.filter((location) => location.active),
    [referenceData.locations],
  );
  const activeTasks = useMemo(
    () => referenceData.tasks.filter((task) => task.active),
    [referenceData.tasks],
  );
  const locationOptions = useMemo(() => {
    if (!editingAssignment) {
      return activeLocations;
    }

    const currentLocation = editingAssignment.location;
    return activeLocations.some((location) => location.id === currentLocation.id)
      ? activeLocations
      : [currentLocation, ...activeLocations];
  }, [activeLocations, editingAssignment]);
  const taskOptions = useMemo(() => {
    if (!editingAssignment) {
      return activeTasks;
    }

    const currentTask = editingAssignment.task;
    return activeTasks.some((task) => task.id === currentTask.id)
      ? activeTasks
      : [currentTask, ...activeTasks];
  }, [activeTasks, editingAssignment]);

  const activeCount = initialData.locationTasks.filter((assignment) => assignment.active).length;
  const inactiveCount = initialData.locationTasks.length - activeCount;

  const openCreateModal = () => {
    setEditingAssignment(null);
    setDraft({
      locationId: activeLocations[0]?.id ?? "",
      taskId: activeTasks[0]?.id ?? "",
      allocatedAmount: "",
      active: true,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const openEditModal = (assignment: LocationTaskListItem) => {
    setEditingAssignment(assignment);
    setDraft({
      id: assignment.id,
      locationId: assignment.locationId,
      taskId: assignment.taskId,
      allocatedAmount: assignment.allocatedAmount,
      active: assignment.active,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const refresh = () => router.refresh();

  const submitAssignment = async () => {
    setFeedback(null);

    const payload = editingAssignment
      ? {
          allocatedAmount: draft.allocatedAmount,
          active: draft.active,
        }
      : {
          locationId: draft.locationId,
          taskId: draft.taskId,
          allocatedAmount: draft.allocatedAmount,
          active: draft.active,
        };

    const endpoint = editingAssignment
      ? `/api/gaa/location-tasks/${editingAssignment.id}`
      : "/api/gaa/location-tasks";
    const method = editingAssignment ? "PATCH" : "POST";
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
        text: json.error ?? "Unable to save the assignment.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: editingAssignment
        ? "Location task assignment updated successfully."
        : "Location task assignment created successfully.",
    });
    setModalOpen(false);
    refresh();
  };

  const toggleActive = async (assignment: LocationTaskListItem) => {
    const shouldDeactivate = assignment.active;
    const confirmed = window.confirm(
      shouldDeactivate
        ? "Deactivate this location task assignment?\n\nThe assignment will stay in the system for historical records."
        : "Activate this location task assignment again?",
    );

    if (!confirmed) {
      return;
    }

    setTableBusyId(assignment.id);
    setFeedback(null);

    const response = await fetch(`/api/gaa/location-tasks/${assignment.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !assignment.active }),
    });

    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setTableBusyId(null);

    if (!response.ok) {
      setFeedback({
        kind: "error",
        text: json.error ?? "Unable to update the assignment.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: assignment.active ? "Assignment deactivated." : "Assignment activated.",
    });
    refresh();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Assignments</p>
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
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {initialData.locationTasks.length}
          </p>
        </div>
      </section>

      {pageError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {pageError}
        </div>
      ) : null}

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
            <h2 className="text-xl font-semibold text-slate-900">Location task assignments</h2>
            <p className="mt-1 text-sm text-slate-500">
              Assign active cleaning tasks to active locations and configure the allocated amount.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={activeLocations.length === 0 || activeTasks.length === 0}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Assignment
          </button>
        </div>

        <form
          method="get"
          action="/gaa/location-tasks"
          className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <input
            name="query"
            defaultValue={currentFilters.query}
            placeholder="Search location or task"
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900 xl:col-span-2"
          />
          <select
            name="locationId"
            defaultValue={currentFilters.locationId}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All Locations</option>
            {referenceData.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name}
                {location.active ? "" : " (Inactive)"}
              </option>
            ))}
          </select>
          <select
            name="taskId"
            defaultValue={currentFilters.taskId}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All Tasks</option>
            {referenceData.tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name} ({task.frequency})
                {task.active ? "" : " (Inactive)"}
              </option>
            ))}
          </select>
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
          <input type="hidden" name="sortBy" value={currentFilters.sortBy} />
          <input type="hidden" name="sortOrder" value={currentFilters.sortOrder} />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 xl:col-span-5"
          >
            Apply Filters
          </button>
        </form>

        <div className="mt-6 space-y-4 md:hidden">
          {initialData.locationTasks.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              No assignments match the current filters.
            </div>
          ) : (
            initialData.locationTasks.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {assignment.location.code}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{assignment.location.name}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      assignment.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {assignment.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Task</p>
                    <p className="mt-1">
                      {assignment.task.name} ({assignment.frequency})
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Allocation</p>
                    <p className="mt-1">{formatAmount(assignment.allocatedAmount)}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Created</p>
                    <p className="mt-1">{formatDate(assignment.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Updated</p>
                    <p className="mt-1">{formatDate(assignment.updatedAt)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(assignment)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit Amount
                  </button>
                  <button
                    type="button"
                    disabled={tableBusyId === assignment.id}
                    onClick={() => {
                      void toggleActive(assignment);
                    }}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {tableBusyId === assignment.id
                      ? "Saving..."
                      : assignment.active
                        ? "Deactivate"
                        : "Activate"}
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
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Task
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Frequency
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Allocation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {initialData.locationTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    No assignments match the current filters.
                  </td>
                </tr>
              ) : (
                initialData.locationTasks.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm text-slate-900">
                      <p className="font-medium">{assignment.location.code}</p>
                      <p className="text-slate-500">{assignment.location.name}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{assignment.task.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{assignment.frequency}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatAmount(assignment.allocatedAmount)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          assignment.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {assignment.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(assignment)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit Amount
                        </button>
                        <button
                          type="button"
                          disabled={tableBusyId === assignment.id}
                          onClick={() => {
                            void toggleActive(assignment);
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {tableBusyId === assignment.id
                            ? "Saving..."
                            : assignment.active
                              ? "Deactivate"
                              : "Activate"}
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
            Showing {initialData.locationTasks.length} of {initialData.total} assignments
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/gaa/location-tasks${buildQueryString({
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
              href={`/gaa/location-tasks${buildQueryString({
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
                  {editingAssignment ? "Edit Assignment" : "Add Assignment"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingAssignment
                    ? "Update the allocated amount or active status for this location task assignment."
                    : "Assign an active task to an active location and set the allocated amount."}
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
                <span className="text-sm font-medium text-slate-700">Location</span>
                <select
                  value={draft.locationId}
                  disabled={Boolean(editingAssignment)}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, locationId: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
                >
                  <option value="">Select a location</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} - {location.name}
                    </option>
                  ))}
                </select>
                {editingAssignment ? (
                  <p className="text-xs text-slate-500">
                    Location and task are fixed after assignment creation.
                  </p>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Cleaning Task</span>
                <select
                  value={draft.taskId}
                  disabled={Boolean(editingAssignment)}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, taskId: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
                >
                  <option value="">Select a task</option>
                  {taskOptions.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name} ({task.frequency})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Allocated Amount</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.allocatedAmount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      allocatedAmount: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  placeholder="50000.00"
                />
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
                disabled={
                  isPending ||
                  (!editingAssignment && (!draft.locationId || !draft.taskId || !draft.allocatedAmount))
                }
                onClick={() => {
                  startTransition(() => {
                    void submitAssignment();
                  });
                }}
                className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? "Saving..."
                  : editingAssignment
                    ? "Update Assignment"
                    : "Create Assignment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
