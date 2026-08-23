import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { finalizePaymentRecommendation, PaymentRecommendationError } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("GAA"); const body = await request.json().catch(() => ({})); return NextResponse.json(await finalizePaymentRecommendation(prisma, appUser, (await params).id, typeof body.remarks === "string" ? body.remarks : "")); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to finalize recommendation." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); } }
