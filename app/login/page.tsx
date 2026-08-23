"use client";

import Link from "next/link";
import Image from "next/image";
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
    <main className="min-h-screen bg-[#f4f6f9] px-0 py-0 text-slate-900 sm:p-6">
      <div className="mx-auto grid min-h-screen w-full max-w-[1110px] overflow-hidden bg-white shadow-[0_14px_36px_rgba(15,23,42,0.14)] sm:min-h-[calc(100vh-3rem)] sm:rounded-[2.25rem] lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden bg-[#063b87] px-12 py-14 text-white lg:flex lg:flex-col lg:items-center lg:justify-between">
          <div className="absolute inset-0 opacity-30 [background-image:repeating-radial-gradient(ellipse_at_top_left,transparent_0,transparent_24px,rgba(77,190,255,0.45)_25px,transparent_26px)]" />
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
            <Image src="/UniLogo.png" alt="University of Sri Lanka emblem" width={220} height={290} className="h-auto w-[220px] object-contain" priority />
            <h1 className="mt-7 max-w-[430px] text-[36px] font-bold leading-[1.22] tracking-[-0.02em]">
              University Cleaning<br />Monitoring System
            </h1>
            <div className="mt-5 h-0.5 w-28 bg-cyan-400" />
            <p className="mt-6 max-w-[350px] text-[19px] leading-7 text-blue-50">
              Professional monitoring for<br />campus cleaning operations.
            </p>
          </div>
          <div className="absolute -bottom-20 -left-12 h-48 w-[125%] rounded-[50%] border-t border-cyan-300/30 [transform:rotate(-12deg)]" />
          <div className="absolute -bottom-28 -left-16 h-48 w-[125%] rounded-[50%] border-t border-cyan-300/20 [transform:rotate(-12deg)]" />
        </section>

        <section className="flex w-full items-center justify-center px-6 py-12 sm:px-12 lg:px-12 xl:px-16">
          <div className="w-full max-w-[458px]">
            <div className="text-center">
              <h2 className="text-[34px] font-bold tracking-[-0.03em] text-[#0b367b]">Sign In</h2>
              <div className="mx-auto mt-4 h-0.5 w-14 bg-[#1260d3]" />
              <p className="mt-6 text-[15px] text-slate-500">Use your institutional email and password to continue.</p>
            </div>

          {searchParams.get("redirectedFrom") ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Please sign in again to continue.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-800">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                className="h-[54px] w-full rounded-[10px] border border-slate-300 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1260d3] focus:ring-2 focus:ring-blue-100"
                placeholder="you@example.edu"
                autoComplete="email"
              />
              {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-800">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  className="h-[54px] w-full rounded-[10px] border border-slate-300 bg-white px-4 py-3 pr-20 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1260d3] focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 my-2 px-2 text-sm text-slate-500 hover:text-[#1260d3]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            </label>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#1260d3]" />
                Keep me signed in
              </label>
              <Link href="/forgot-password" className="font-semibold text-[#125bd0] hover:text-[#0b367b]">
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
              className="inline-flex h-[50px] w-full items-center justify-center rounded-[9px] bg-[#125bd0] px-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#0b4bab] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-center text-sm text-slate-600">
              New to the system?{" "}
              <Link href="/signup" className="font-semibold text-[#125bd0] hover:text-[#0b367b]">
                Create an account
              </Link>
            </p>
          </form>
          </div>
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
