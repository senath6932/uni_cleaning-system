import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getFinalReport, PaymentRecommendationError } from "@/lib/final-reports";
import { generateFinalPdf } from "@/lib/final-report-files";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ year: string; month: string }> }) {
  try { const { appUser } = await requireRole("GAA"); const values = await params; const report = await getFinalReport(prisma, appUser, Number(values.year), Number(values.month)); const file = await generateFinalPdf(report); await prisma.activityLog.create({ data: { userId: appUser.id, action: "FINAL_REPORT_PDF_GENERATED", entityType: "FinalReport", entityId: `${values.year}-${values.month}`, description: "Final report PDF generated.", metadata: { year: Number(values.year), month: Number(values.month) } } }); return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="University_Cleaning_Final_All_Locations_Report_${values.year}_${String(values.month).padStart(2, "0")}.pdf"` } }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate PDF." }, { status: error instanceof PaymentRecommendationError ? error.status : 500 }); }
}
