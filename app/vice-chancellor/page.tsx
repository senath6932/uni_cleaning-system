import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { LogoutButton } from "@/app/_components/logout-button";

export default async function ViceChancellorPage() {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser || appUser.role !== "VICE_CHANCELLOR") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-semibold text-white">Vice Chancellor access only</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This dashboard is restricted to Vice Chancellors.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Vice Chancellor
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Recommendation review</h1>
              <p className="mt-2 text-sm text-slate-300">Signed in as {appUser.name}.</p>
            </div>
            <LogoutButton />
          </div>
        </header>
      </div>
    </main>
  );
}

