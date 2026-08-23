import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getFinalReport, PaymentRecommendationError } from "@/lib/final-reports";
import { prisma } from "@/lib/prisma";
export async function GET(_: Request, { params }: { params: Promise<{ year: string; month: string }> }) { try { const { appUser } = await requireRole("GAA"); return NextResponse.json(await getFinalReport(prisma, appUser, Number((await params).year), Number((await params).month))); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load final report." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); } }
