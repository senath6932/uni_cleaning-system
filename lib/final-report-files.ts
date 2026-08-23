import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { PrismaClient, UserRole } from "@/app/generated/prisma/client";
import { getFinalReport } from "@/lib/final-reports";

type FinalReport = Awaited<ReturnType<typeof getFinalReport>>;
const money = (value: unknown) => `LKR ${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown) => Array.isArray(value) ? value : [];
const dateLabel = (year: number, month: number) => new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));

export async function generateFinalPdf(data: FinalReport) {
  const document = new PDFDocument({ margin: 42, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => { document.on("data", (chunk: Buffer) => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); document.on("error", reject); });
  document.fontSize(18).font("Helvetica-Bold").text("UNIVERSITY CLEANING SYSTEM", { align: "center" });
  document.fontSize(14).text("FINAL MONTHLY PAYMENT RECOMMENDATION REPORT", { align: "center" });
  document.moveDown().fontSize(10).font("Helvetica").text(`Reporting Month: ${dateLabel(data.year, data.month)}`).text(`Generated: ${new Date().toLocaleString()}`).text(`Locations: ${data.recommendations.length}`).text(`Total Recommended Payment: ${money(data.totals.overall)}`);
  for (const recommendation of data.recommendations) {
    const location = recommendation.report.location;
    document.addPage().fontSize(15).font("Helvetica-Bold").text(`LOCATION: ${location.name} (${location.code})`);
    document.fontSize(10).font("Helvetica").text(`Administration Status: ${recommendation.report.status}`).text(`Recommendation Status: ${recommendation.status}`).text(`Prepared By: ${recommendation.createdBy.name}`).text(`Finalized: ${recommendation.finalizedAt?.toLocaleString() ?? "-"}`);
    document.moveDown().font("Helvetica-Bold").text(`Cleaning Tasks - ${money(recommendation.locationCleaningTotal)}`);
    for (const task of recommendation.report.taskSummaries) { const calculation = recommendation.taskCalculations.find((item) => item.monthlyTaskSummaryId === task.id); document.font("Helvetica").text(`${task.taskNameSnapshot} | P ${task.passedOccurrences} X ${task.failedOccurrences} NA ${task.notApplicableOccurrences} | ${String(task.completionPercentage)}% | Original ${money(task.allocatedAmount)} | Recommendation ${money(calculation?.recommendationAmount)} | Recommended ${money(calculation?.recommendedAmount)}`); }
    document.moveDown().font("Helvetica-Bold").text("DAILY EVALUATION HISTORY");
    for (const task of recommendation.report.taskSummaries) for (const entry of array(task.evaluationHistory)) { const item = record(entry); document.font("Helvetica").text(`${String(item.date ?? "-")} | ${task.taskNameSnapshot} | ${String(item.result ?? "-")} | ${String(item.evaluatingOfficerName ?? "-")} | ${String(item.remark ?? "-")}`); }
    document.moveDown().font("Helvetica-Bold").text(`Additional Tasks - ${money(recommendation.additionalTasks.reduce((sum, task) => sum + Number(task.recommendedAmount), 0))}`);
    for (const task of recommendation.additionalTasks) document.font("Helvetica").text(`${task.taskName} | ${task.category} | ${String(task.completionPercentage)}% | ${money(task.allocatedAmount)} | ${money(task.recommendedAmount)} | ${task.remark ?? "-"}`);
    document.moveDown().font("Helvetica-Bold").text("PHI DAILY TOTAL PRESENT");
    for (const entry of array(recommendation.report.attendanceHistory)) { const item = record(entry); document.font("Helvetica").text(`${String(item.date ?? "-")} | ${String(item.totalPresentCount ?? "-")} | ${String(item.phiUserName ?? "PHI")}`); }
    document.moveDown().font("Helvetica-Bold").text("Administration Review");
    for (const review of recommendation.report.administrationReviews) document.font("Helvetica").text(`${review.decision} | ${review.reviewer.name} | ${review.reviewedAt.toLocaleDateString()} | ${review.remarks ?? "-"}`);
  }
  document.addPage().fontSize(18).font("Helvetica-Bold").text("FINAL RECOMMENDED PAYMENT", { align: "center" }).moveDown().fontSize(22).text(money(data.totals.overall), { align: "center" });
  const range = document.bufferedPageRange(); for (let index = range.start; index < range.start + range.count; index += 1) { document.switchToPage(index); document.fontSize(8).font("Helvetica").text(`University Cleaning System | Final Monthly Payment Recommendation Report | Page ${index + 1} of ${range.count}`, 42, 800, { align: "center", width: 510 }); }
  document.end();
  return result;
}

export async function generateFinalExcel(data: FinalReport) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "University Cleaning System";
  const summary = workbook.addWorksheet("Summary"); summary.addRows([["FINAL MONTHLY PAYMENT RECOMMENDATION REPORT"], ["Reporting Month", dateLabel(data.year, data.month)], ["Total Locations", data.recommendations.length], ["Total Recommended Payment", Number(data.totals.overall)]]); summary.getCell("A1").font = { bold: true, size: 16 }; summary.getCell("B4").numFmt = 'LKR #,##0.00';
  const locations = workbook.addWorksheet("Location Summary"); locations.addRow(["Location", "Cleaning Total", "Additional Task Total", "Location Total"]); for (const recommendation of data.recommendations) { const additional = recommendation.additionalTasks.reduce((sum, task) => sum + Number(task.recommendedAmount), 0); locations.addRow([recommendation.report.location.name, Number(recommendation.locationCleaningTotal), additional, Number(recommendation.locationGrandTotal)]); } formatSheet(locations, ["LKR #,##0.00", "LKR #,##0.00", "LKR #,##0.00"]);
  const tasks = workbook.addWorksheet("Task Recommendations"); tasks.addRow(["Location", "Task", "Category", "P", "X", "NA", "Applicable", "Completion %", "Original Allocation", "Recommendation Allocation", "Recommended Amount", "Additional Task?"]); for (const recommendation of data.recommendations) { for (const task of recommendation.report.taskSummaries) { const calc = recommendation.taskCalculations.find((item) => item.monthlyTaskSummaryId === task.id); tasks.addRow([recommendation.report.location.name, task.taskNameSnapshot, task.categorySnapshot, task.passedOccurrences, task.failedOccurrences, task.notApplicableOccurrences, task.passedOccurrences + task.failedOccurrences, Number(task.completionPercentage) / 100, Number(task.allocatedAmount), Number(calc?.recommendationAmount ?? 0), Number(calc?.recommendedAmount ?? 0), "No"]); } for (const task of recommendation.additionalTasks) tasks.addRow([recommendation.report.location.name, task.taskName, task.category, "", "", "", "", Number(task.completionPercentage) / 100, Number(task.allocatedAmount), Number(task.allocatedAmount), Number(task.recommendedAmount), "Yes"]); } formatSheet(tasks, ["0.00%", "LKR #,##0.00", "LKR #,##0.00", "LKR #,##0.00"]);
  const phi = workbook.addWorksheet("PHI Total Present"); phi.addRow(["Location", "Date", "Total Present", "PHI"]); for (const recommendation of data.recommendations) for (const entry of array(recommendation.report.attendanceHistory)) { const item = record(entry); phi.addRow([recommendation.report.location.name, item.date ?? "", item.totalPresentCount ?? "", item.phiUserName ?? "PHI"]); }
  const evaluations = workbook.addWorksheet("Daily Evaluations"); evaluations.addRow(["Location", "Date", "Task", "Result", "Evaluating Officer", "Remark"]); for (const recommendation of data.recommendations) for (const task of recommendation.report.taskSummaries) for (const entry of array(task.evaluationHistory)) { const item = record(entry); evaluations.addRow([recommendation.report.location.name, item.date ?? "", task.taskNameSnapshot, item.result ?? "", item.evaluatingOfficerName ?? "", item.remark ?? ""]); }
  const history = workbook.addWorksheet("Review History"); history.addRow(["Location", "Action", "User", "Date", "Remarks"]); for (const recommendation of data.recommendations) for (const review of recommendation.report.administrationReviews) history.addRow([recommendation.report.location.name, review.decision, review.reviewer.name, review.reviewedAt, review.remarks ?? ""]); for (const event of data.history) history.addRow(["All locations", event.action, event.user.name, event.timestamp, event.description ?? ""]);
  for (const sheet of workbook.worksheets) { sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(sheet.columnCount, 12))}1` }; for (const column of sheet.columns) column.width = Math.max(14, Math.min(32, (column.header?.toString().length ?? 12) + 4)); }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function formatSheet(sheet: ExcelJS.Worksheet, formats: string[]) { for (let row = 2; row <= sheet.rowCount; row += 1) formats.forEach((format, index) => { sheet.getCell(row, index + 2).numFmt = format; }); }

export async function loadFinalReport(prisma: Pick<PrismaClient, "paymentRecommendation" | "activityLog">, actor: { id: string; role: UserRole; active: boolean }, year: number, month: number) { return getFinalReport(prisma, actor, year, month); }
