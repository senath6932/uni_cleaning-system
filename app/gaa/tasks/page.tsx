import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AppShell } from "@/app/_components/app-shell";
import { prisma } from "@/lib/prisma";
import { listManagedTasks, type CleaningTaskListResult } from "@/lib/task-management";
import { GaaTaskManagementClient } from "./task-management-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function GaaTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { sessionUser, appUser } = await getAuthContext();
  const params = await searchParams;

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "GAA") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-semibold text-white">GAA access only</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Only GAA users can manage cleaning tasks.
          </p>
        </div>
      </main>
    );
  }

  const query = firstString(params.query) ?? "";
  const frequency = firstString(params.frequency) ?? "";
  const status = firstString(params.status) ?? "";
  const page = Number(firstString(params.page) ?? "1");
  const pageSize = Number(firstString(params.pageSize) ?? "10");

  let data: CleaningTaskListResult;
  let pageError: string | null = null;

  try {
    data = await listManagedTasks(prisma, {
      query,
      frequency,
      status,
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    });
  } catch {
    data = { tasks: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    pageError = "Unable to load cleaning tasks right now.";
  }

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                GAA Cleaning Task Management
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Manage global cleaning tasks
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Define the reusable cleaning tasks that will later be assigned to locations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/gaa"
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to GAA Dashboard
              </Link>
            </div>
          </div>
        </section>

        <GaaTaskManagementClient
          initialData={data}
          currentFilters={{
            query,
            frequency,
            status,
            page: Number.isNaN(page) ? 1 : page,
            pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
          }}
          pageError={pageError}
        />
      </div>
    </AppShell>
  );
}
