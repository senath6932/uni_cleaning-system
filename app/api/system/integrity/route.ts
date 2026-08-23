import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { runSystemIntegrityChecks } from "@/lib/system-administration";
import { prisma } from "@/lib/prisma";
export async function GET() { try { const { appUser } = await requireRole("GAA"); return NextResponse.json(await runSystemIntegrityChecks(prisma, appUser)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run integrity checks." }, { status: 403 }); } }
