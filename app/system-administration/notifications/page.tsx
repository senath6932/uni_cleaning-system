import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { listNotifications, unreadNotificationCount } from "@/lib/system-administration";
import { prisma } from "@/lib/prisma";
import { NotificationActions } from "./notification-actions";
export default async function NotificationsPage() { const { sessionUser, appUser } = await getAuthContext(); if (!sessionUser) redirect("/login"); if (!appUser || appUser.role !== "GAA") return <main className="p-8">Access denied.</main>; const [notifications, unread] = await Promise.all([listNotifications(prisma, appUser), unreadNotificationCount(prisma, appUser)]); return <AppShell user={appUser}><div className="mx-auto max-w-5xl"><header><p className="eyebrow">System Administration</p><h1 className="mt-2 text-3xl font-semibold">Notifications ({unread})</h1></header><NotificationActions initial={notifications} /></div></AppShell>; }
