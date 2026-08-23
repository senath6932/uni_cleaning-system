"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { User, UserRole } from "@/app/generated/prisma/client";
import { LogoutButton } from "@/app/_components/logout-button";

type AppUser = Pick<User, "name" | "email" | "role" | "active">;

type NavItem = {
  href: string;
  label: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navByRole: Record<UserRole, NavSection[]> = {
  GAA: [
    {
      title: "Overview",
      items: [{ href: "/dashboard/gaa", label: "Dashboard" }],
    },
    {
      title: "Management",
      items: [
        { href: "/gaa/users", label: "Users" },
        { href: "/gaa/locations", label: "Locations" },
        { href: "/gaa/tasks", label: "Cleaning Tasks" },
        { href: "/gaa/location-tasks", label: "Location <-> Task Assignments" },
      ],
    },
    {
      title: "Assignments",
      items: [{ href: "/gaa/evaluating-officer-assignments", label: "Evaluating Officer Assignments" }],
    },
    {
      title: "Reports",
      items: [{ href: "/monthly-reports", label: "Monthly Reports" }, { href: "/gaa/payment-recommendations", label: "Payment Recommendations" }, { href: "/gaa/final-reports", label: "Final Reports" }],
    },
    {
      title: "System Administration",
      items: [{ href: "/system-administration", label: "Quality Control" }, { href: "/system-administration/audit", label: "Audit Logs" }, { href: "/system-administration/notifications", label: "Notifications" }, { href: "/system-administration/reports", label: "Report History" }, { href: "/system-administration/permissions", label: "Permissions" }],
    },
  ],
  EVALUATING_OFFICER: [
    {
      title: "Overview",
      items: [{ href: "/dashboard/evaluating-officer", label: "Dashboard" }],
    },
    {
      title: "Monitoring",
      items: [
        { href: "/dashboard/evaluating-officer#locations", label: "My Locations" },
        { href: "/daily-monitoring", label: "Daily Monitoring" },
      ],
    },
    {
      title: "History",
      items: [
        { href: "/evaluating-officer/history", label: "Evaluation History" },
        { href: "/monthly-reports", label: "Monthly Reports" },
      ],
    },
  ],
  PHI: [
    {
      title: "Overview",
      items: [{ href: "/dashboard/phi", label: "Dashboard" }],
    },
    {
      title: "Monitoring",
      items: [{ href: "/daily-monitoring", label: "Daily Attendance" }],
    },
    {
      title: "History",
      items: [
        { href: "/phi/attendance-history", label: "Attendance History" },
      ],
    },
  ],
  ADMINISTRATION_OFFICER: [
    {
      title: "Overview",
      items: [
        { href: "/dashboard/administration", label: "Dashboard" },
        { href: "/administration/reports", label: "Administration Review" },
        { href: "/monthly-reports", label: "Monthly Reports" },
      ],
    },
  ],
  VICE_CHANCELLOR: [
    {
      title: "Overview",
      items: [{ href: "/dashboard/vice-chancellor", label: "Dashboard" }],
    },
  ],
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sections = useMemo(() => navByRole[user.role], [user.role]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              University Cleaning Monitoring System
            </p>
          </div>

          <nav className="flex-1 space-y-6 px-4 py-5">
            {sections.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                        isActivePath(pathname, item.href)
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-200 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Signed in
            </p>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {user.role}
              </p>
            </div>
          </div>
        </aside>

        {drawerOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-80 transform border-r border-slate-200 bg-white transition duration-200 lg:hidden ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Menu
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
            >
              Close
            </button>
          </div>
          <nav className="space-y-6 px-4 py-5">
            {sections.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`block rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                        isActivePath(pathname, item.href)
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <span className="text-sm font-semibold">Menu</span>
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    University Cleaning Monitoring System
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {pathname === "/daily-monitoring"
                      ? "Daily Monitoring"
                      : "Role-based administration"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{user.role}</p>
                </div>
                <details className="relative">
                  <summary className="list-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-50">
                    Profile
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {user.role}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      className="mt-2 block rounded-2xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Profile
                    </Link>
                    <div className="px-1 py-1.5">
                      <LogoutButton />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
