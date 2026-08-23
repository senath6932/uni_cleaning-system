"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { applicationRoles, type ApplicationRole } from "@/lib/application-roles";
import type { UserListItem, UserListResult } from "@/lib/user-management";

type Props = {
  initialData: UserListResult;
  currentFilters: {
    query: string;
    role: string;
    status: string;
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: string;
  };
};

type DraftUser = {
  id?: string;
  name: string;
  email: string;
  role: ApplicationRole;
  active: boolean;
  password: string;
  passwordConfirmation: string;
};

const roleOptions = applicationRoles;

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

export function GaaUserManagementClient({ initialData, currentFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterFormRef = useRef<HTMLFormElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [draft, setDraft] = useState<DraftUser>({
    name: "",
    email: "",
    role: applicationRoles[0],
    active: true,
    password: "",
    passwordConfirmation: "",
  });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [tableBusyId, setTableBusyId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  const currentQuery = useMemo(
    () => ({
      query: searchParams.get("query") ?? currentFilters.query,
      role: searchParams.get("role") ?? currentFilters.role,
      status: searchParams.get("status") ?? currentFilters.status,
      page: Number(searchParams.get("page") ?? currentFilters.page),
      pageSize: Number(searchParams.get("pageSize") ?? currentFilters.pageSize),
      sortBy: searchParams.get("sortBy") ?? currentFilters.sortBy,
      sortOrder: searchParams.get("sortOrder") ?? currentFilters.sortOrder,
    }),
    [currentFilters, searchParams],
  );

  const openCreateModal = () => {
    setEditingUser(null);
    setDraft({
      name: "",
      email: "",
      role: applicationRoles[0],
      active: true,
      password: "",
      passwordConfirmation: "",
    });
    setFeedback(null);
    setShowPassword(false);
    setShowPasswordConfirmation(false);
    setModalOpen(true);
  };

  const openEditModal = (user: UserListItem) => {
    setEditingUser(user);
    setDraft({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      password: "",
      passwordConfirmation: "",
    });
    setFeedback(null);
    setShowPassword(false);
    setShowPasswordConfirmation(false);
    setModalOpen(true);
  };

  const refresh = () => router.refresh();

  const submitUser = async () => {
    setFeedback(null);
    if (!editingUser) {
      if (draft.password.length < 8) {
        setFeedback({ kind: "error", text: "Password must be at least 8 characters." });
        return;
      }
      if (draft.password !== draft.passwordConfirmation) {
        setFeedback({ kind: "error", text: "Passwords do not match." });
        return;
      }
    }
    const payload = {
      name: draft.name,
      email: draft.email,
      role: draft.role,
      active: draft.active,
      ...(editingUser
        ? {}
        : {
            password: draft.password,
            passwordConfirmation: draft.passwordConfirmation,
          }),
    };

    const endpoint = editingUser ? `/api/gaa/users/${editingUser.id}` : "/api/gaa/users";
    const method = editingUser ? "PATCH" : "POST";
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
        text: json.error ?? "Unable to save the user.",
      });
      return;
    }

    setFeedback({
      kind: "success",
      text: editingUser ? "User updated successfully." : "User created successfully.",
    });
    setModalOpen(false);
    refresh();
  };

  const toggleActive = async (user: UserListItem) => {
    const shouldDeactivate = user.active;
    const confirmed = window.confirm(
      shouldDeactivate
        ? "Deactivate this user?\n\nThe user will no longer be able to access the system. Historical records will be preserved."
        : "Activate this user again?",
    );

    if (!confirmed) {
      return;
    }

    setTableBusyId(user.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/gaa/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active: !user.active }),
      });

      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFeedback({
          kind: "error",
          text: json.error ?? "Unable to update the user in the database.",
        });
        return;
      }

      setFeedback({
        kind: "success",
        text: user.active
          ? "User deactivated in the database."
          : "User activated in the database.",
      });
      router.refresh();
    } catch {
      setFeedback({
        kind: "error",
        text: "The user could not be updated. Check the server connection and try again.",
      });
    } finally {
      setTableBusyId(null);
    }
  };

  const deleteUser = async (user: UserListItem) => {
    if (!window.confirm(`Permanently delete ${user.name} from PostgreSQL and Supabase Auth? This cannot be undone.`)) return;
    setTableBusyId(user.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/gaa/users/${user.id}`, { method: "DELETE" });
      const json = (await response.json().catch(() => ({}))) as { error?: string; warning?: string };
      if (!response.ok) {
        setFeedback({ kind: "error", text: json.error ?? "Unable to delete the user." });
        return;
      }
      setFeedback({
        kind: json.warning ? "error" : "success",
        text: json.warning ?? "User deleted from the database and authentication.",
      });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "The user could not be deleted. Check the server connection and try again." });
    } finally {
      setTableBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
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
            <h2 className="text-xl font-semibold text-slate-900">User directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and maintain application users with Supabase Auth-backed identity.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Add User
          </button>
        </div>

        <form
          ref={filterFormRef}
          method="get"
          action="/gaa/users"
          className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
        >
          <input
            name="query"
            defaultValue={currentQuery.query}
            placeholder="Search name or email"
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900 xl:col-span-2"
          />
          <select
            name="role"
            defaultValue={currentQuery.role}
            onChange={() => filterFormRef.current?.requestSubmit()}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={currentQuery.status}
            onChange={() => filterFormRef.current?.requestSubmit()}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            name="sortBy"
            defaultValue={currentQuery.sortBy}
            onChange={() => filterFormRef.current?.requestSubmit()}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="createdAt">Created Date</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
            <option value="active">Status</option>
          </select>
          <select
            name="sortOrder"
            defaultValue={currentQuery.sortOrder}
            onChange={() => filterFormRef.current?.requestSubmit()}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <input type="hidden" name="page" value="1" />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Apply Filters
          </button>
        </form>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
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
              {initialData.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    No users match the current filters.
                  </td>
                </tr>
              ) : (
                initialData.users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">
                      {user.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{user.role}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {user.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={tableBusyId === user.id}
                          onClick={() => { void deleteUser(user); }}
                          className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete Permanently
                        </button>
                        <button
                          type="button"
                          disabled={tableBusyId === user.id}
                          onClick={() => {
                            void toggleActive(user);
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {tableBusyId === user.id
                            ? "Saving..."
                            : user.active
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
            Showing {initialData.users.length} of {initialData.total} users
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/gaa/users${buildQueryString({
                ...currentQuery,
                page: Math.max(1, currentQuery.page - 1),
              })}`}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Previous
            </Link>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              Page {initialData.page} of {initialData.totalPages}
            </span>
            <Link
              href={`/gaa/users${buildQueryString({
                ...currentQuery,
                page: Math.min(initialData.totalPages, currentQuery.page + 1),
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
                  {editingUser ? "Edit User" : "Add User"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingUser
                    ? "Update the application profile, role, or active status."
                    : "Create a new Supabase Auth-backed application user."}
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
                <span className="text-sm font-medium text-slate-700">Full Name</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  value={draft.email}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, email: event.target.value }))
                  }
                  readOnly={Boolean(editingUser)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 read-only:bg-slate-100"
                />
                {editingUser ? (
                  <p className="text-xs text-slate-500">
                    Email is read-only because authentication identity is managed by Supabase.
                  </p>
                ) : null}
              </label>

              {!editingUser ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="relative grid gap-2">
                    <span className="text-sm font-medium text-slate-700">Password</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={draft.password}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, password: event.target.value }))
                      }
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-9 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {showPassword ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.3A10.7 10.7 0 0112 4c5.2 0 8.7 4 9.8 6a11.8 11.8 0 01-3.1 3.8M6.2 6.2C4.4 7.5 3.1 9.2 2.2 10.8 3.3 12.8 6.8 16.8 12 16.8c1 0 1.9-.2 2.8-.5" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.2 10.8C3.3 8.8 6.8 4.8 12 4.8s8.7 4 9.8 6c-1.1 2-4.6 6-9.8 6s-8.7-4-9.8-6z" />
                          <circle cx="12" cy="10.8" r="2.4" />
                        </svg>
                      )}
                    </button>
                  </label>
                  <label className="relative grid gap-2">
                    <span className="text-sm font-medium text-slate-700">Confirm Password</span>
                    <input
                      type={showPasswordConfirmation ? "text" : "password"}
                      value={draft.passwordConfirmation}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          passwordConfirmation: event.target.value,
                        }))
                      }
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirmation((current) => !current)}
                      aria-label={showPasswordConfirmation ? "Hide password" : "Show password"}
                      title={showPasswordConfirmation ? "Hide password" : "Show password"}
                      className="absolute right-3 top-9 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {showPasswordConfirmation ? (
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.3A10.7 10.7 0 0112 4c5.2 0 8.7 4 9.8 6a11.8 11.8 0 01-3.1 3.8M6.2 6.2C4.4 7.5 3.1 9.2 2.2 10.8 3.3 12.8 6.8 16.8 12 16.8c1 0 1.9-.2 2.8-.5" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.2 10.8C3.3 8.8 6.8 4.8 12 4.8s8.7 4 9.8 6c-1.1 2-4.6 6-9.8 6s-8.7-4-9.8-6z" />
                          <circle cx="12" cy="10.8" r="2.4" />
                        </svg>
                      )}
                    </button>
                  </label>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Role</span>
                  <select
                    value={draft.role}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        role: event.target.value as ApplicationRole,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
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
                    void submitUser();
                  });
                }}
                className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : editingUser ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
