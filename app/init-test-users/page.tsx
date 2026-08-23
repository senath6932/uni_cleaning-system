"use client";

import { useState } from "react";

type TestUserResult = { email: string; status: string; password?: string; role?: string; message?: string };
type TestUserResponse = { message: string; results?: TestUserResult[]; error?: string };

export default function InitTestUsersPage() {
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestUserResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/init/test-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceRoleKey }),
      });

      const data = (await response.json()) as TestUserResponse;

      if (!response.ok) {
        setError(data.error || data.message || "Failed to create test users");
        setLoading(false);
        return;
      }

      setResults(data);
      setServiceRoleKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-white shadow-lg">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">Initialize Test Users</h1>
            <p className="mt-2 text-sm text-slate-300">
              Create test user accounts for the University Cleaning System
            </p>
          </div>

          <div className="p-8">
            <div className="mb-8 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-semibold">📋 Instructions:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Go to <a href="https://app.supabase.com/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Supabase Console</a></li>
                <li>Select your project</li>
                <li>Go to <strong>Settings → API</strong></li>
                <li>Copy the <strong>Service Role key</strong> (secret key)</li>
                <li>Paste it below and click Initialize</li>
              </ol>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="key" className="block text-sm font-medium text-slate-700">
                  Supabase Service Role Key
                </label>
                <input
                  id="key"
                  type="password"
                  value={serviceRoleKey}
                  onChange={(e) => setServiceRoleKey(e.target.value)}
                  placeholder="eyJ..."
                  className="mt-2 w-full rounded border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !serviceRoleKey}
                className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white transition disabled:opacity-50 hover:bg-blue-700"
              >
                {loading ? "Initializing..." : "Initialize Test Users"}
              </button>
            </form>

            {error && (
              <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
              </div>
            )}

            {results && (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
                  <p className="font-semibold">✅ Success!</p>
                  <p>{results.message}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900">Test Credentials:</h3>
                  <div className="mt-3 space-y-3">
                    {results.results?.map((result) => (
                      <div key={result.email} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p className="font-semibold text-slate-900">{result.email}</p>
                        {result.status === "success" && (
                          <>
                            <p className="text-slate-600">
                              <span className="font-medium">Password:</span> {result.password}
                            </p>
                            <p className="text-slate-600">
                              <span className="font-medium">Role:</span> {result.role}
                            </p>
                          </>
                        )}
                        {result.status === "error" && (
                          <p className="text-red-600">❌ Error: {result.message}</p>
                        )}
                        {result.status === "partial" && (
                          <p className="text-yellow-600">⚠️ {result.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="font-semibold">Next Steps:</p>
                  <p className="mt-2">
                    👉 <a href="/login" className="font-semibold underline">
                      Go to Login Page
                    </a>
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    Use any of the credentials above to log in
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
