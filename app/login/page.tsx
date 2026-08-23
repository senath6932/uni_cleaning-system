"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailError = useMemo(() => {
    if (!emailTouched) return null;
    if (!email.trim()) return "Email is required.";
    if (!isValidEmail(email.trim())) return "Enter a valid email address.";
    return null;
  }, [email, emailTouched]);

  const passwordError = useMemo(() => {
    if (!passwordTouched) return null;
    if (!password) return "Password is required.";
    return null;
  }, [password, passwordTouched]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setEmailTouched(true);
    setPasswordTouched(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail) || !password) {
      return;
    }

    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError(
        signInError.message.toLowerCase().includes("invalid api key")
          ? "Supabase login is not configured. Update NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env with the current anon/publishable key, then restart the server."
          : "Invalid email or password.",
      );
      return;
    }

    if (!signInData.session) {
      setIsSubmitting(false);
      setError("We couldn't complete sign-in for this account.");
      return;
    }

    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      }),
    });
    const sessionJson = (await sessionResponse.json().catch(() => ({}))) as { error?: string; redirectTo?: string };

    setIsSubmitting(false);

    if (!sessionResponse.ok || !sessionJson.redirectTo) {
      await supabase.auth.signOut();
      setError(sessionJson.error ?? "We couldn't complete sign-in for this account.");
      return;
    }

    router.replace(sessionJson.redirectTo);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-6 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden h-full flex-col justify-between rounded-[2rem] border border-slate-200 bg-slate-900 p-10 text-white shadow-2xl shadow-slate-900/10 lg:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              University Cleaning Monitoring System
            </p>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight">
              Professional monitoring for campus cleaning operations.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              Sign in with your Supabase account to access role-based dashboards, daily monitoring,
              and the management tools you are authorized to use.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            {[
              "Role-based access",
              "Secure Supabase authentication",
              "Responsive university UI",
              "Audit-friendly workflows",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 lg:-ml-10 lg:p-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
              UCM
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                Sign in
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                University Cleaning Monitoring System
              </h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            Use your institutional email and password to continue.
          </p>

          {searchParams.get("redirectedFrom") ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Please sign in again to continue.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                placeholder="you@example.edu"
                autoComplete="email"
              />
              {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-28 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-2 my-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            </label>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded border-slate-300 text-slate-900" />
                Keep me signed in
              </label>
              <Link href="/forgot-password" className="font-medium text-slate-700 hover:text-slate-950">
                Forgot password?
              </Link>
            </div>

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-center text-sm text-slate-600">
              New to the system?{" "}
              <Link href="/signup" className="font-medium text-slate-900 hover:text-cyan-700">
                Create an account
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100" />}>
      <LoginForm />
    </Suspense>
  );
}
