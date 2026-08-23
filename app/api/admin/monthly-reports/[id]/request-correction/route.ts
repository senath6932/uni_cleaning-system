import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { decideMonthlyReport } from "@/lib/administration-review";
import { prisma } from "@/lib/prisma";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("ADMINISTRATION_OFFICER"); const body = await request.json().catch(() => ({})); const result = await decideMonthlyReport(prisma, appUser, (await params).id, "CORRECTION", typeof body.remarks === "string" ? body.remarks : undefined); return NextResponse.json(result); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete this review." }, { status: "status" in (error as object) ? Number((error as { status?: number }).status) || 500 : 500 }); } }
