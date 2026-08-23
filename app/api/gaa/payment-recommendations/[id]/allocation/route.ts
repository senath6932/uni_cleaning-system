import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { PaymentRecommendationError, updateRecommendationAllocation } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("GAA"); const body = await request.json().catch(() => ({})); return NextResponse.json(await updateRecommendationAllocation(prisma, appUser, (await params).id, body.calculationId, body.amount, body.reason ?? "")); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update allocation." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); } }
