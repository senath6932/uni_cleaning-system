"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CleaningTaskListItem, CleaningTaskListResult } from "@/lib/task-management";
import { taskFrequencies, type TaskFrequencyValue } from "@/lib/task-definitions";

type Props = {
  initialData: CleaningTaskListResult;
  currentFilters: {
    query: string;
    frequency: string;
    status: string;
    page: number;
    pageSize: number;
  };
  pageError: string | null;
};

type DraftTask = {
  id?: string;
  name: string;
  frequency: TaskFrequencyValue;
  active: boolean;
};

const frequencyOptions = taskFrequencies;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export function GaaTaskManagementClient({ initialData, currentFilters, pageError }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CleaningTaskListItem | null>(null);
  const [draft, setDraft] = useState<DraftTask>({
    name: "",
    frequency: "DAILY",
    active: true,
  });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [tableBusyId, setTableBusyId] = useState<string | null>(null);

  const activeCount = initialData.tasks.filter((task) => task.active).length;
  const inactiveCount = initialData.tasks.length - activeCount;

  const openCreateModal = () => {
    setEditingTask(null);
    setDraft({
      name: "",
      frequency: "DAILY",
      active: true,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const openEditModal = (task: CleaningTaskListItem) => {
    setEditingTask(task);
    setDraft({
      id: task.id,
      name: task.name,
      frequency: task.frequency,
      active: task.active,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const refresh = () => router.refresh();

  const submitTask = async () => {
    setFeedback(null);

    const payload = {
      name: draft.name,
      frequency: draft.frequency,
      active: draft.active,
    };

    const endpoint = editingTask ? `/api/gaa/tasks/${editingTask.id}` : "/api/gaa/tasks";
    const method = editingTask ? "PATCH" : "POST";
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
        text: json.error ?? "Unable to save the task.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: editingTask ? "Task updated successfully." : "Task created successfully.",
    });
    setModalOpen(false);
    refresh();
  };

  const toggleActive = async (task: CleaningTaskListItem) => {
    const shouldDeactivate = task.active;
    const confirmed = window.confirm(
      shouldDeactivate
        ? "Deactivate this cleaning task?\n\nThe task will no longer be active for new operational use.\nExisting historical records will be preserved."
        : "Activate this cleaning task again?",
    );

    if (!confirmed) {
      return;
    }

    setTableBusyId(task.id);
    setFeedback(null);

    const response = await fetch(`/api/gaa/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !task.active }),
    });

    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setTableBusyId(null);

    if (!response.ok) {
      setFeedback({
        kind: "error",
        text: json.error ?? "Unable to update the task.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: task.active ? "Task deactivated." : "Task activated.",
    });
    refresh();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Tasks</p>
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
          <p className="mt-2 text-3xl font-semibold text-slate-900">{initialData.tasks.length}</p>
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
            <h2 className="text-xl font-semibold text-slate-900">Cleaning task directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure reusable cleaning tasks for future location assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Add Task
          </button>
        </div>

        <form
          method="get"
          action="/gaa/tasks"
          className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
        >
          <input
            name="query"
            defaultValue={currentFilters.query}
            placeholder="Search task name"
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900 xl:col-span-2"
          />
          <select
            name="frequency"
            defaultValue={currentFilters.frequency}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All Frequencies</option>
            {frequencyOptions.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
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
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Apply Filters
          </button>
        </form>

        <div className="mt-6 space-y-4 md:hidden">
          {initialData.tasks.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              No tasks match the current filters.
            </div>
          ) : (
            initialData.tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{task.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{task.frequency}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      task.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {task.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Created</p>
                    <p className="mt-1">{formatDate(task.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Updated</p>
                    <p className="mt-1">{formatDate(task.updatedAt)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(task)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={tableBusyId === task.id}
                    onClick={() => {
                      void toggleActive(task);
                    }}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {tableBusyId === task.id
                      ? "Saving..."
                      : task.active
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
                  Task Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Frequency
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created At
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {initialData.tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    No tasks match the current filters.
                  </td>
                </tr>
              ) : (
                initialData.tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">
                      {task.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{task.frequency}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          task.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={tableBusyId === task.id}
                          onClick={() => {
                            void toggleActive(task);
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {tableBusyId === task.id
                            ? "Saving..."
                            : task.active
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
            Showing {initialData.tasks.length} of {initialData.total} tasks
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/gaa/tasks${buildQueryString({
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
              href={`/gaa/tasks${buildQueryString({
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
                  {editingTask ? "Edit Task" : "Add Task"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingTask
                    ? "Update the task name, frequency, or active status."
                    : "Create a new cleaning task definition."}
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
                <span className="text-sm font-medium text-slate-700">Task Name</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  placeholder="Floor Cleaning"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Frequency</span>
                <select
                  value={draft.frequency}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      frequency: event.target.value as TaskFrequencyValue,
                    }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                >
                  {frequencyOptions.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency}
                    </option>
                  ))}
                </select>
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
                    void submitTask();
                  });
                }}
                className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
