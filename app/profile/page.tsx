import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AppShell } from "@/app/_components/app-shell";

export default async function ProfilePage() {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!appUser) {
    redirect("/login");
  }

  return (
    <AppShell user={appUser}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Account details</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Review your current account information. Role changes and authorization settings are
            controlled by administrators.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Name", value: appUser.name },
            { label: "Email", value: appUser.email },
            { label: "Role", value: appUser.role },
            { label: "Status", value: appUser.active ? "Active" : "Inactive" },
          ].map((item) => (
            <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{item.value}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
