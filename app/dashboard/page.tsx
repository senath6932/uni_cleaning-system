import { redirect } from "next/navigation";
import { getAuthContext, roleRedirectPath } from "@/lib/auth";

export default async function DashboardPage() {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
            Access denied
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            No application user profile found
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            You are authenticated in Supabase, but there is no matching PostgreSQL
            User row for this Supabase UUID yet. Please ask an administrator to
            create the application profile.
          </p>
        </div>
      </main>
    );
  }

  redirect(roleRedirectPath[appUser.role]);
}

