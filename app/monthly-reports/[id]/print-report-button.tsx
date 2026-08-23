"use client";
export function PrintReportButton() { return <button type="button" onClick={() => window.print()} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Print Report</button>; }
