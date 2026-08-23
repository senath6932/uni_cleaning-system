import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { PaymentRecommendationError, submitPaymentRecommendation } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("GAA"); return NextResponse.json(await submitPaymentRecommendation(prisma, appUser, (await params).id)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit recommendation." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); } }
