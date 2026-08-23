"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PHI_MONTHLY_ATTENDANCE_CATEGORIES } from "@/lib/phi-monthly-attendance";

type SerializableReport = {
  id: string;
  month: number;
  year: number;
  status: string;
  processingError: string | null;
  grandTotal: string;
  generatedAt: string | null;
  submittedAt: string | null;
  resubmittedAt: string | null;
  finalizedAt: string | null;
  rows: Array<{
    id: string;
    category: string;
    employeeCount: number;
    deductionRate: string;
    rowTotal: string;
  }>;
};

type Props = {
  month: number;
  year: number;
  categories: typeof PHI_MONTHLY_ATTENDANCE_CATEGORIES;
  initialReport: SerializableReport | null;
};

type DraftRow = {
  category: string;
  employeeCount: string;
  deductionRate: string;
};

function defaultRows(categories: Props["categories"]) {
  return categories.map((category) => ({
    category: category.key,
    employeeCount: "0",
    deductionRate: category.defaultRate,
  }));
}

function formatAmount(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
}

export function PhiMonthlyAttendanceClient({ month, year, categories, initialReport }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedReport, setSavedReport] = useState<SerializableReport | null>(initialReport);
  const [rows, setRows] = useState<DraftRow[]>(
    initialReport?.rows.length
      ? initialReport.rows.map((row) => ({
          category: row.category,
          employeeCount: String(row.employeeCount),
          deductionRate: row.deductionRate,
        }))
      : defaultRows(categories),
  );

  const summary = useMemo(() => {
    const rowsWithTotals = rows.map((row) => {
      const employeeCount = Number(row.employeeCount);
      const deductionRate = Number(row.deductionRate);
      const rowTotal = Number.isFinite(employeeCount) && Number.isFinite(deductionRate) ? employeeCount * deductionRate : 0;
      return { ...row, rowTotal };
    });
    const grandTotal = rowsWithTotals.reduce((sum, row) => sum + row.rowTotal, 0);
    return { rows: rowsWithTotals, grandTotal };
  }, [rows]);

  async function persist(action: "save" | "submit") {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/phi/monthly-attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        month,
        year,
        action,
        rows: rows.map((row) => ({
          category: row.category,
          employeeCount: row.employeeCount,
          deductionRate: row.deductionRate,
        })),
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; report?: SerializableReport };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to save the report.");
    }

    if (payload.report) {
      setSavedReport(payload.report);
      setRows(
        payload.report.rows.map((row) => ({
          category: row.category,
          employeeCount: String(row.employeeCount),
          deductionRate: row.deductionRate,
        })),
      );
    }

    setMessage(action === "submit" ? "Report submitted successfully." : "Draft saved successfully.");
    if (payload.report) {
      startTransition(() => router.refresh());
    }
  }

  const savedReportLink = savedReport ? `/phi/monthly-attendance/${savedReport.id}` : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Monthly Attendance Summary
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Reporting period: {new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)))}
          </p>
        </div>
        {savedReportLink ? (
          <Link href={savedReportLink} className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
            Open saved report
          </Link>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {rows.map((row, index) => {
          const category = categories.find((item) => item.key === row.category);
          const employeeCount = Number(row.employeeCount);
          const deductionRate = Number(row.deductionRate);
          const rowTotal = Number.isFinite(employeeCount) && Number.isFinite(deductionRate) ? employeeCount * deductionRate : 0;

          return (
            <article key={row.category} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{category?.label ?? row.category}</p>
                    <p className="mt-1 text-xs text-slate-500">Category {index + 1}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                    {formatAmount(String(rowTotal))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Number of Employees
                    </span>
                    <input
                      value={row.employeeCount}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRows((current) => current.map((item) => (item.category === row.category ? { ...item, employeeCount: value } : item)));
                      }}
                      inputMode="numeric"
                      type="number"
                      min="0"
                      step="1"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Deduction Rate per Person
                    </span>
                    <input
                      value={row.deductionRate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRows((current) => current.map((item) => (item.category === row.category ? { ...item, deductionRate: value } : item)));
                      }}
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                    />
                  </label>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">Total Amount</p>
        <p className="mt-2 text-3xl font-semibold">{formatAmount(String(summary.grandTotal))}</p>
        {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              persist("save").catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to save the report."));
            });
          }}
          className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save Draft"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              persist("submit").catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to submit the report."));
            });
          }}
          className="rounded-2xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Submitting..." : "Submit Monthly Report"}
        </button>
      </div>
    </section>
  );
}
