// src/routes/revision/reviewToReportDocument.ts
//
// Adapter: Finding[] + review session -> report-core's generic
// ReportDocument, the same architectural role adapters/bcf.ts plays for
// BCF data (report-core's own pdf/excel/model modules know nothing
// about OGUC or Finding - this file is the only place that translates
// between them). ONE document, not two: report-core's Excel renderer
// puts each Section with a heading on its own sheet (see excel/render.ts),
// so the 4 sections defined here ARE the 4 sheets Part 4-B asks for
// (Resumen/Ocupación/Escaleras/Metadatos) - the same 4 sections read as
// 4 consecutive pages in the PDF, which consolidates the brief's
// separately-named "Pre-Check Summary" and "Summary Statistics" blocks
// into the single "Resumen" section, rather than diverging into a
// second adapter function the way bcf.ts's two genuinely different
// layouts required - the underlying information is unchanged, just
// grouped under one heading instead of three.
//
// Real data gap, adapted rather than papered over: the brief's Excel
// column spec asks for "Categoría Calculada" (occupancy) and "Ancho
// Mín./Ancho Real" (stairs) - neither exists on Finding. Occupancy
// findings only ever fire for spaces the engine could NOT classify (see
// generateFindings.ts), so there is no calculated category to show by
// definition. Stairs findings carry oguc-core's evaluateStairCompliance
// verdict as formatted text (description), not the raw required/
// detected width numbers as separate fields. Both tables use what
// Finding actually carries (element, title/description, state, note)
// instead of inventing columns from data that isn't there.
import type { ReportDocument, Section, TableRow } from "@bw-central/report-core";
import type { BwrevPreCheckResults, Finding, FindingSeverity, FindingState } from "@bw-central/oguc-core";

export interface ReviewReportInput {
  modelName: string;
  /** Full SHA-256 - callers display a truncated form (see FINDING_HASH_DISPLAY_LENGTH), the full value is kept in Metadatos for traceability. */
  modelHash: string;
  reviewDate: Date;
  preCheckResults: BwrevPreCheckResults;
  findings: Finding[];
}

export const REPORT_HASH_DISPLAY_LENGTH = 8;

const SEVERITY_FILL: Record<FindingSeverity, string | undefined> = {
  error: "#FDECEA",
  warning: "#FFF8E1",
  info: undefined,
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = { error: "Error", warning: "Advertencia", info: "Información" };
const STATE_LABEL: Record<FindingState, string> = { pending: "Pendiente", accepted: "Aceptado", rejected: "Rechazado" };
const RULE_LABEL: Record<Finding["ruleId"], string> = { occupancy: "Art. 4.2.4 — Clasificación de Carga de Ocupación", stairs: "Art. 4.2.10 — Validación de Escaleras" };

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function findingElementLabel(f: Finding): string {
  if (f.elementId === 0) return "Edificio completo";
  return f.elementName ? `${f.elementName} (#${f.elementId})` : `#${f.elementId}`;
}

function findingRow(f: Finding): TableRow {
  return {
    cells: {
      elemento: findingElementLabel(f),
      hallazgo: f.title,
      detalle: f.description,
      estado: STATE_LABEL[f.state],
      severidad: SEVERITY_LABEL[f.severity],
      nota: f.userNote ?? "",
    },
    fill: SEVERITY_FILL[f.severity],
  };
}

function ruleSection(ruleId: Finding["ruleId"], findings: Finding[]): Section {
  const inRule = findings.filter((f) => f.ruleId === ruleId);
  const errors = inRule.filter((f) => f.severity === "error").length;
  const warnings = inRule.filter((f) => f.severity === "warning").length;

  return {
    heading: ruleId === "occupancy" ? "Ocupación" : "Escaleras",
    pageBreakBefore: true,
    blocks: [
      { type: "text", text: RULE_LABEL[ruleId], style: "heading" },
      {
        type: "keyValue",
        columns: 2,
        items: [
          { label: "Total hallazgos", value: String(inRule.length) },
          { label: "Errores", value: String(errors) },
          { label: "Advertencias", value: String(warnings) },
        ],
      },
      {
        type: "table",
        columns: [
          { key: "elemento", header: "Elemento", width: 26 },
          { key: "hallazgo", header: "Hallazgo", width: 26 },
          { key: "detalle", header: "Detalle", width: 40 },
          { key: "estado", header: "Estado", width: 12 },
          { key: "severidad", header: "Severidad", width: 12 },
          { key: "nota", header: "Nota", width: 24 },
        ],
        rows: inRule.length > 0 ? inRule.map(findingRow) : [{ cells: { elemento: "—", hallazgo: "Sin hallazgos", detalle: "", estado: "", severidad: "", nota: "" } }],
      },
    ],
  };
}

export function reviewToReportDocument(input: ReviewReportInput): ReportDocument {
  const { findings, preCheckResults } = input;
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const info = findings.filter((f) => f.severity === "info").length;
  const pending = findings.filter((f) => f.state === "pending").length;
  const accepted = findings.filter((f) => f.state === "accepted").length;
  const rejected = findings.filter((f) => f.state === "rejected").length;
  const acceptanceRate = findings.length > 0 ? Math.round((accepted / findings.length) * 100) : 0;
  const hashShort = input.modelHash.slice(0, REPORT_HASH_DISPLAY_LENGTH);

  const summarySection: Section = {
    heading: "Resumen",
    blocks: [
      { type: "text", text: "Pre-Check", style: "subheading" },
      {
        type: "keyValue",
        columns: 2,
        items: [
          { label: "Bloqueantes", value: String(preCheckResults.blocking.length) },
          { label: "Advertencias", value: String(preCheckResults.warnings.length) },
          { label: "Información", value: String(preCheckResults.info.length) },
        ],
      },
      { type: "text", text: "Hallazgos", style: "subheading" },
      {
        type: "keyValue",
        columns: 2,
        items: [
          { label: "Total hallazgos", value: String(findings.length) },
          { label: "Errores", value: String(errors) },
          { label: "Advertencias", value: String(warnings) },
          { label: "Información", value: String(info) },
          { label: "Pendientes", value: String(pending) },
          { label: "Aceptados", value: String(accepted) },
          { label: "Rechazados", value: String(rejected) },
          { label: "Tasa de aceptación", value: `${acceptanceRate}%` },
        ],
      },
      {
        type: "chart",
        chartType: "donut",
        title: "Hallazgos por severidad",
        data: [
          { label: "Error", value: errors, color: "#EF4444" },
          { label: "Advertencia", value: warnings, color: "#E8A33D" },
          { label: "Información", value: info, color: "#8A94A0" },
        ],
      },
    ],
  };

  const metadataSection: Section = {
    heading: "Metadatos",
    pageBreakBefore: true,
    blocks: [
      {
        type: "keyValue",
        columns: 1,
        items: [
          { label: "Modelo", value: input.modelName },
          { label: "SHA-256", value: input.modelHash },
          { label: "Fecha de revisión", value: formatDateLong(input.reviewDate) },
        ],
      },
    ],
  };

  const sections: Section[] = [summarySection, ruleSection("occupancy", findings), ruleSection("stairs", findings), metadataSection];

  return {
    title: "Revisión de Cumplimiento OGUC",
    subtitle: `${input.modelName} — ${hashShort}`,
    date: input.reviewDate.toISOString(),
    sections,
    footerTemplate: `Generado por BWise OGUC Reviewer | ${formatDateLong(new Date())} · Página {page} de {total}`,
    showCoverPage: true,
  };
}
