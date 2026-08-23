import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listEvaluatingOfficerReferenceData,
  listManagedEvaluatingOfficerAssignments,
  type EvaluatingOfficerAssignmentListResult,
  type EvaluatingOfficerReferenceData,
} from "@/lib/evaluating-officer-assignments";
import { GaaEvaluatingOfficerAssignmentClient } from "./evaluating-officer-assignment-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function GaaEvaluatingOfficerAssignmentsPage({
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
            Only GAA users can manage evaluating officer assignments.
          </p>
        </div>
      </main>
    );
  }

  const query = firstString(params.query) ?? "";
  const officerId = firstString(params.officerId) ?? "";
  const locationId = firstString(params.locationId) ?? "";
  const status = firstString(params.status) ?? "";
  const page = Number(firstString(params.page) ?? "1");
  const pageSize = Number(firstString(params.pageSize) ?? "10");
  const sortBy = firstString(params.sortBy) ?? "createdAt";
  const sortOrder = firstString(params.sortOrder) ?? "desc";

  const filters = {
    query,
    officerId,
    locationId,
    status,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    sortBy: sortBy === "createdAt" || sortBy === "active" ? sortBy : "createdAt",
    sortOrder: sortOrder === "asc" ? "asc" : "desc",
  } as const;

  let data: EvaluatingOfficerAssignmentListResult = {
    assignments: [],
    total: 0,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: 1,
  };
  let referenceData: EvaluatingOfficerReferenceData = {
    officers: [],
    locations: [],
    activeOfficers: [],
    activeLocations: [],
  };
  let pageError: string | null = null;

  const [assignmentsResult, referenceResult] = await Promise.allSettled([
    listManagedEvaluatingOfficerAssignments(prisma, filters),
    listEvaluatingOfficerReferenceData(prisma),
  ]);

  if (assignmentsResult.status === "fulfilled") {
    data = assignmentsResult.value;
  } else {
    pageError = "Unable to load evaluating officer assignments right now.";
  }

  if (referenceResult.status === "fulfilled") {
    referenceData = referenceResult.value;
  } else if (!pageError) {
    pageError = "Unable to load assignment options right now.";
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                GAA Evaluating Officer Assignment
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Assign evaluating officers to locations
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Manage which active evaluating officers can perform daily evaluations for each
                active location.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/gaa"
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to GAA Dashboard
              </Link>
            </div>
          </div>
        </header>

        <GaaEvaluatingOfficerAssignmentClient
          initialData={data}
          referenceData={referenceData}
          currentFilters={filters}
          pageError={pageError}
        />
      </div>
    </main>
  );
}
