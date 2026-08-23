import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getPaymentRecommendation, PaymentRecommendationError, updateRecommendationRemarks } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";
function errorResponse(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process payment recommendation." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); }
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("GAA"); const result = await getPaymentRecommendation(prisma, appUser, (await params).id); if (!result) return NextResponse.json({ error: "Recommendation not found." }, { status: 404 }); return NextResponse.json(result); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("GAA"); const body = await request.json().catch(() => ({})); return NextResponse.json(await updateRecommendationRemarks(prisma, appUser, (await params).id, typeof body.remarks === "string" ? body.remarks : "")); } catch (error) { return errorResponse(error); } }
