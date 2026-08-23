import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/system-administration";
import { prisma } from "@/lib/prisma";
export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireAuthenticatedUser(); return NextResponse.json(await markNotificationRead(prisma, appUser, (await params).id)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update notification." }, { status: 403 }); } }
