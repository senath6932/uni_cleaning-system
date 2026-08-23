export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[34rem] animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </div>
    </main>
  );
}
