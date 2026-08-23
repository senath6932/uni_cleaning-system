import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function PHIDailyMonitoringPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { sessionUser, appUser } = await getAuthContext();
  const params = await searchParams;

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "PHI") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-semibold text-white">PHI access only</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This monitoring area is restricted to assigned PHIs.
          </p>
        </div>
      </main>
    );
  }

  const query = new URLSearchParams();
  const locationId = firstString(params.locationId);
  const date = firstString(params.date);

  if (locationId) {
    query.set("locationId", locationId);
  }

  if (date) {
    query.set("date", date);
  }

  redirect(query.size > 0 ? `/daily-monitoring?${query.toString()}` : "/daily-monitoring");
}
