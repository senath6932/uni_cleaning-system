import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createPaymentRecommendation, listGaaEligibleReports, PaymentRecommendationError } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";

function errorResponse(error: unknown) { const status = error instanceof PaymentRecommendationError ? error.status : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process payment recommendation." }, { status }); }
export async function GET() { try { const { appUser } = await requireRole("GAA"); return NextResponse.json(await listGaaEligibleReports(prisma, appUser)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const { appUser } = await requireRole("GAA"); const body = await request.json().catch(() => ({})); if (typeof body.reportId !== "string") return NextResponse.json({ error: "reportId is required." }, { status: 400 }); return NextResponse.json(await createPaymentRecommendation(prisma, appUser, body.reportId)); } catch (error) { return errorResponse(error); } }
