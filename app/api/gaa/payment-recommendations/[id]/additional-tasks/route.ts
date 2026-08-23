import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { addAdditionalRecommendationTask, PaymentRecommendationError } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { appUser } = await requireRole("GAA"); return NextResponse.json(await addAdditionalRecommendationTask(prisma, appUser, (await params).id, await request.json())); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add task." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); } }
