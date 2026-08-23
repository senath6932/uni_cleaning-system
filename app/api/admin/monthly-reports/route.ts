import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { AdministrationReviewError, listAdministrationReports } from "@/lib/administration-review";
import { prisma } from "@/lib/prisma";

function errorResponse(error: unknown) { if (error instanceof AuthError) return NextResponse.json({ error: error.message, code: "AUTH_ERROR" }, { status: error.status }); if (error instanceof AdministrationReviewError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status }); return NextResponse.json({ error: "Unable to load Administration reviews." }, { status: 500 }); }
export async function GET(request: Request) { try { const { appUser } = await requireRole("ADMINISTRATION_OFFICER"); const url = new URL(request.url); const number = (key: string) => Number(url.searchParams.get(key) ?? "") || undefined; return NextResponse.json(await listAdministrationReports(prisma, appUser, { query: url.searchParams.get("query") ?? undefined, month: number("month"), year: number("year"), locationId: url.searchParams.get("locationId") ?? undefined, status: url.searchParams.get("status") ?? undefined, page: number("page") })); } catch (error) { return errorResponse(error); } }
