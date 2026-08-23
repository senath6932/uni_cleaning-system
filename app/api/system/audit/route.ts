import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listAuditLogs } from "@/lib/system-administration";
import { prisma } from "@/lib/prisma";
export async function GET(request: Request) { try { const { appUser } = await requireRole("GAA"); const url = new URL(request.url); return NextResponse.json(await listAuditLogs(prisma, appUser, { query: url.searchParams.get("query") ?? undefined, userId: url.searchParams.get("userId") ?? undefined, role: (url.searchParams.get("role") as never) || undefined, action: url.searchParams.get("action") ?? undefined, page: Number(url.searchParams.get("page") ?? 1) })); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load audit logs." }, { status: 403 }); } }
