"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { applicationRoles, type ApplicationRole } from "@/lib/application-roles";

const roleLabels: Record<ApplicationRole, string> = {
  GAA: "General Administrative Assistant",
  EVALUATING_OFFICER: "Evaluating Officer",
  PHI: "Public Health Inspector",
  ADMINISTRATION_OFFICER: "Administration Officer",
  VICE_CHANCELLOR: "Vice Chancellor",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<ApplicationRole | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordError = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (confirmPassword && password !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [password, confirmPassword]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const formIsInvalid =
      !trimmedName ||
      !isValidEmail(trimmedEmail) ||
      password.length < 6 ||
      password !== confirmPassword ||
      !role;

    if (formIsInvalid) {
      setError("Complete all fields and check your password before continuing.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        password,
        role,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setError(result.error ?? "We could not create your account.");
      return;
    }

    setSuccess(true);
    window.setTimeout(() => router.replace("/login"), 1200);
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_48%,#e2e8f0_100%)] px-6 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden h-full flex-col justify-between rounded-[2rem] bg-slate-900 p-10 text-white shadow-2xl shadow-slate-900/10 lg:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Join the monitoring system
            </p>
            <h1 className="mt-6 max-w-md text-4xl font-semibold tracking-tight">
              Create your role-based university account.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              Choose the role that matches your responsibilities. Your dashboard and permissions will follow that selection.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-50">
            All five operational roles are available during registration.
          </div>
        </section>

        <section className="mx-auto w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 lg:-ml-10 lg:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sign up</p>
              <h2 className="mt-1 text-3xl font-semibold text-slate-950">Create an account</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">UCM</div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Full name</span>
              <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" placeholder="Your full name" autoComplete="name" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" placeholder="you@example.edu" autoComplete="email" />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" autoComplete="new-password" />
                {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Confirm password</span>
                <input required minLength={6} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" autoComplete="new-password" />
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Role</span>
              <select required value={role} onChange={(event) => setRole(event.target.value as ApplicationRole)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900">
                <option value="">Select your role</option>
                {applicationRoles.map((applicationRole) => (
                  <option key={applicationRole} value={applicationRole}>{roleLabels[applicationRole]}</option>
                ))}
              </select>
            </label>

            {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Account created. Redirecting you to sign in...</p> : null}
            <button type="submit" disabled={isSubmitting || success} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
            <p className="text-center text-sm text-slate-600">
              Already have an account? <Link href="/login" className="font-semibold text-slate-900 hover:text-cyan-700">Sign in</Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}