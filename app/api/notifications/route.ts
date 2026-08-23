import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead } from "@/lib/system-administration";
import { prisma } from "@/lib/prisma";
export async function GET(request: Request) { try { const { appUser } = await requireAuthenticatedUser(); const filter = new URL(request.url).searchParams.get("filter"); return NextResponse.json({ notifications: await listNotifications(prisma, appUser, filter === "read" || filter === "unread" ? filter : "all") }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load notifications." }, { status: 401 }); } }
export async function PATCH() { try { const { appUser } = await requireAuthenticatedUser(); return NextResponse.json(await markAllNotificationsRead(prisma, appUser)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update notifications." }, { status: 401 }); } }
