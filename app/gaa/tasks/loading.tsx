export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-3 w-48 rounded-full bg-slate-200" />
          <div className="mt-4 h-8 w-80 rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-slate-200" />
        </div>

        <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="h-24 rounded-3xl bg-slate-100" />
            <div className="h-24 rounded-3xl bg-slate-100" />
            <div className="h-24 rounded-3xl bg-slate-100" />
            <div className="h-24 rounded-3xl bg-slate-100" />
          </div>
          <div className="mt-6 h-12 rounded-2xl bg-slate-100" />
          <div className="mt-6 space-y-3">
            <div className="h-16 rounded-3xl bg-slate-100" />
            <div className="h-16 rounded-3xl bg-slate-100" />
            <div className="h-16 rounded-3xl bg-slate-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
