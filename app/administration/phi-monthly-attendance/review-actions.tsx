"use client";

import { useState } from "react";

type Props = {
  reportId: string;
};

async function postDecision(path: string, remarks?: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ remarks }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to complete the review.");
  }
}

export function ReviewActions({ reportId }: Props) {
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "correction" | "reject" | null>(null);

  async function run(action: "approve" | "correction" | "reject") {
    setBusy(action);
    setError(null);
    setMessage(null);

    try {
      const route = action === "approve"
        ? `/api/admin/phi-monthly-attendance/${reportId}/approve`
        : action === "correction"
          ? `/api/admin/phi-monthly-attendance/${reportId}/request-correction`
          : `/api/admin/phi-monthly-attendance/${reportId}/reject`;
      await postDecision(route, remarks.trim() || undefined);
      setMessage(
        action === "approve" ? "Report approved." : action === "correction" ? "Correction requested." : "Report rejected.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete the review.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Remarks
        </span>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
          placeholder="Optional for approval, required for correction or rejection."
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("approve")}
          className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "approve" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("correction")}
          className="rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "correction" ? "Requesting..." : "Request Correction"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("reject")}
          className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>

      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
