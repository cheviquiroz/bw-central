// src/routes/revision/generateReports.ts
//
// Renders the SAME ReportDocument (reviewToReportDocument.ts) through
// both of report-core's existing renderers and triggers two downloads -
// no new PDF/Excel generation logic here, this file is pure glue between
// the adapter and the browser's download mechanism (same Blob +
// URL.createObjectURL pattern as bwrev.ts).
import { renderPdf, renderExcel } from "@bw-central/report-core";
import type { ReportDocument } from "@bw-central/report-core";
import { sanitizeModelNameForFilename } from "./bwrev";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateForFilename(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface GenerateReportsResult {
  pdfFilename: string;
  excelFilename: string;
}

export async function generateReportsAndDownload(document: ReportDocument, modelName: string | undefined): Promise<GenerateReportsResult> {
  const safeModelName = sanitizeModelNameForFilename(modelName);
  const dateStamp = formatDateForFilename(new Date());
  const pdfFilename = `bwrev_reporte_${safeModelName}_${dateStamp}.pdf`;
  const excelFilename = `bwrev_reporte_${safeModelName}_${dateStamp}.xlsx`;

  // In parallel - both renderers work off the same immutable document,
  // there's no reason to serialize the two.
  const [pdfBytes, excelBytes] = await Promise.all([renderPdf(document), renderExcel(document)]);

  downloadBytes(pdfBytes, pdfFilename, "application/pdf");
  downloadBytes(excelBytes, excelFilename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  return { pdfFilename, excelFilename };
}
