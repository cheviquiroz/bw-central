// Modelo genérico -> PDF. Motor de layout con flujo/paginación automática
// (ensureSpace/startNewPage), generalizado a partir del mismo patrón que ya
// usaba pdfGenerator.js por topic (un cursor `y` + "si no cabe, página
// nueva") - portado como mecanismo genérico de renderer, no como código
// específico de BCF.
//
// jsPDF corre en Node sin ningún polyfill de DOM: verificado directamente
// (texto, formas vectoriales, getImageProperties/addImage con Uint8Array
// crudo) antes de escribir este archivo - ver el resumen del commit que
// agrega este paquete.

import { jsPDF } from "jspdf";
import type { ReportDocument, Section, Block, TextBlock, KeyValueBlock, TableBlock, ImageBlock, ChartBlock } from "../model/document";
import { hexToRgb } from "./color";
import { drawPieChart, drawLegend, drawBarChart, drawHBarChart } from "./charts";

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface RenderContext {
  doc: jsPDF;
  y: number;
  firstPageUsed: boolean;
}

function startNewPage(ctx: RenderContext): void {
  if (ctx.firstPageUsed) {
    ctx.doc.addPage();
  } else {
    ctx.firstPageUsed = true;
  }
  ctx.y = MARGIN;
}

/** Si no hay espacio para `needed` mm antes del margen inferior, arranca página nueva. Devuelve true si lo hizo (útil para volver a dibujar encabezados de tabla). */
function ensureSpace(ctx: RenderContext, needed: number): boolean {
  if (ctx.y + needed > PAGE_H - MARGIN) {
    startNewPage(ctx);
    return true;
  }
  return false;
}

function computeImageBox(doc: jsPDF, bytes: Uint8Array, maxW: number, maxH: number): { width: number; height: number } {
  try {
    const props = doc.getImageProperties(bytes);
    let w = maxW;
    let h = (props.height * w) / props.width;
    if (h > maxH) {
      h = maxH;
      w = (props.width * h) / props.height;
    }
    return { width: w, height: h };
  } catch {
    // imagen corrupta o formato no reconocido por jsPDF: se reserva un
    // recuadro por defecto en vez de romper el render.
    return { width: maxW, height: Math.min(maxH, maxW * 0.6) };
  }
}

function imageFormat(mimeType: "image/png" | "image/jpeg"): "PNG" | "JPEG" {
  return mimeType === "image/jpeg" ? "JPEG" : "PNG";
}

function renderCoverPage(ctx: RenderContext, doc: ReportDocument): void {
  const pdf = ctx.doc;
  let cy = 55;

  if (doc.logo) {
    const box = computeImageBox(pdf, doc.logo.bytes, doc.logo.maxWidthMm ?? 90, doc.logo.maxHeightMm ?? 45);
    try {
      pdf.addImage(doc.logo.bytes, imageFormat(doc.logo.mimeType), (PAGE_W - box.width) / 2, cy, box.width, box.height);
      cy += box.height + 20;
    } catch {
      cy += 15;
    }
  } else {
    cy += 15;
  }

  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  const titleLines: string[] = pdf.splitTextToSize(doc.title, CONTENT_W - 20);
  titleLines.forEach((line) => {
    pdf.text(line, PAGE_W / 2, cy, { align: "center" });
    cy += 10;
  });
  cy += 6;

  if (doc.subtitle) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(90);
    pdf.text(doc.subtitle, PAGE_W / 2, cy, { align: "center" });
    pdf.setTextColor(0);
    cy += 16;
  }

  pdf.setFontSize(10);
  if (doc.author) {
    pdf.text(`Autor: ${doc.author}`, PAGE_W / 2, cy, { align: "center" });
    cy += 6;
  }
  const generatedAt = doc.date ? new Date(doc.date) : new Date();
  const dateText = Number.isNaN(generatedAt.getTime()) ? doc.date! : generatedAt.toLocaleString("es-CL");
  pdf.text(`Generado: ${dateText}`, PAGE_W / 2, cy, { align: "center" });

  ctx.y = cy + 10;
}

function renderSectionHeading(ctx: RenderContext, section: Section): void {
  const { doc } = ctx;
  if (section.accentColor) {
    ensureSpace(ctx, 4);
    doc.setFillColor(...hexToRgb(section.accentColor));
    doc.rect(MARGIN, ctx.y, CONTENT_W, 1.5, "F");
    ctx.y += 5;
  }
  if (section.heading) {
    ensureSpace(ctx, 9);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    const lines: string[] = doc.splitTextToSize(section.heading, CONTENT_W);
    lines.forEach((line) => {
      doc.text(line, MARGIN, ctx.y);
      ctx.y += 6.5;
    });
    ctx.y += 2;
  }
}

const TEXT_STYLES = {
  heading: { size: 14, bold: true, color: 0 },
  subheading: { size: 11, bold: true, color: 0 },
  body: { size: 9, bold: false, color: 0 },
  caption: { size: 8, bold: false, color: 120 },
} as const;

function renderText(ctx: RenderContext, block: TextBlock): void {
  const { doc } = ctx;
  const style = TEXT_STYLES[block.style ?? "body"];
  doc.setFontSize(style.size);
  doc.setFont("helvetica", style.bold ? "bold" : "normal");
  doc.setTextColor(style.color);
  const lineHeight = style.size * 0.45;
  const lines: string[] = doc.splitTextToSize(block.text || "", CONTENT_W);
  lines.forEach((line) => {
    ensureSpace(ctx, lineHeight);
    doc.text(line, MARGIN, ctx.y);
    ctx.y += lineHeight;
  });
  doc.setTextColor(0);
  ctx.y += 2;
}

function renderKeyValue(ctx: RenderContext, block: KeyValueBlock): void {
  const { doc } = ctx;
  doc.setFontSize(9);
  const columns = block.columns ?? 1;

  if (columns === 1) {
    block.items.forEach(({ label, value }) => {
      doc.setFont("helvetica", "bold");
      const labelWidth = 40;
      const lines: string[] = doc.splitTextToSize(value || "—", CONTENT_W - labelWidth);
      const rowHeight = Math.max(5, lines.length * 5);
      ensureSpace(ctx, rowHeight);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, MARGIN, ctx.y);
      doc.setFont("helvetica", "normal");
      doc.text(lines, MARGIN + labelWidth, ctx.y);
      ctx.y += rowHeight;
    });
  } else {
    const col2X = MARGIN + CONTENT_W / 2;
    for (let i = 0; i < block.items.length; i += 2) {
      const left = block.items[i];
      const right = block.items[i + 1];
      const rightLines: string[] = right ? doc.splitTextToSize(right.value || "—", CONTENT_W / 2 - 24) : [];
      const rowHeight = Math.max(5, rightLines.length * 5);
      ensureSpace(ctx, rowHeight);
      const rowY = ctx.y;

      doc.setFont("helvetica", "bold");
      doc.text(`${left.label}:`, MARGIN, rowY);
      doc.setFont("helvetica", "normal");
      doc.text(left.value || "—", MARGIN + 24, rowY);

      if (right) {
        doc.setFont("helvetica", "bold");
        doc.text(`${right.label}:`, col2X, rowY);
        doc.setFont("helvetica", "normal");
        doc.text(rightLines, col2X + 24, rowY);
      }
      ctx.y = rowY + rowHeight;
    }
  }
  ctx.y += 2;
}

function renderImageBlock(ctx: RenderContext, block: ImageBlock): void {
  const { doc } = ctx;
  const maxW = block.maxWidthMm ?? CONTENT_W * 0.7;
  const maxH = block.maxHeightMm ?? 70;
  const box = computeImageBox(doc, block.bytes, maxW, maxH);
  ensureSpace(ctx, box.height + (block.caption ? 7 : 0) + 4);
  try {
    doc.addImage(block.bytes, imageFormat(block.mimeType), MARGIN, ctx.y, box.width, box.height);
    ctx.y += box.height + 2;
  } catch {
    // imagen corrupta o formato no soportado: se omite sin romper el render.
  }
  if (block.caption) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(block.caption, MARGIN, ctx.y);
    doc.setTextColor(0);
    ctx.y += 5;
  }
  ctx.y += 2;
}

function renderChart(ctx: RenderContext, block: ChartBlock): void {
  const { doc } = ctx;
  if (block.title) {
    ensureSpace(ctx, 8);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(block.title, MARGIN, ctx.y);
    ctx.y += 7;
  }

  if (block.chartType === "pie" || block.chartType === "donut") {
    const radius = 20;
    ensureSpace(ctx, radius * 2 + 6);
    const cx = MARGIN + radius + 2;
    const cy = ctx.y + radius;
    drawPieChart(doc, { cx, cy, radius, innerRadiusRatio: block.chartType === "donut" ? 0.55 : 0, data: block.data });
    drawLegend(doc, { x: cx + radius + 8, y: cy - Math.max(0, block.data.length - 1) * 2.75, items: block.data });
    ctx.y += radius * 2 + 6;
  } else if (block.chartType === "barVertical") {
    const height = 35;
    ensureSpace(ctx, height + 12);
    drawBarChart(doc, { x: MARGIN, y: ctx.y, width: CONTENT_W, height, bars: block.data });
    ctx.y += height + 12;
  } else if (block.chartType === "barHorizontal") {
    const rowHeight = 7;
    const totalHeight = block.data.length * rowHeight;
    ensureSpace(ctx, totalHeight + 4);
    drawHBarChart(doc, { x: MARGIN, y: ctx.y, width: CONTENT_W, bars: block.data, rowHeight });
    ctx.y += totalHeight + 4;
  }
  ctx.y += 2;
}

function renderTable(ctx: RenderContext, block: TableBlock): void {
  const { doc } = ctx;
  const columns = block.columns;
  if (columns.length === 0) return;

  const totalWeight = columns.reduce((s, c) => s + (c.width ?? 15), 0);
  const colWidths = columns.map((c) => ((c.width ?? 15) / totalWeight) * CONTENT_W);

  const drawHeader = () => {
    ensureSpace(ctx, 8);
    const rowY = ctx.y;
    doc.setFillColor(...hexToRgb("#1F2937"));
    doc.rect(MARGIN, rowY, CONTENT_W, 7, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255);
    let x = MARGIN;
    columns.forEach((col, i) => {
      doc.text(col.header, x + 1.5, rowY + 5, { maxWidth: colWidths[i] - 3 });
      x += colWidths[i];
    });
    doc.setTextColor(0);
    ctx.y += 7;
  };

  drawHeader();

  block.rows.forEach((row) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const wrapped: Record<string, string[]> = {};
    let maxLines = 1;
    columns.forEach((col, i) => {
      if (row.images?.[col.key]) return; // esta celda es imagen, no texto
      const raw = row.cells[col.key];
      const text = raw === null || raw === undefined ? "" : String(raw);
      const lines: string[] = doc.splitTextToSize(text, colWidths[i] - 3);
      wrapped[col.key] = lines;
      maxLines = Math.max(maxLines, lines.length);
    });

    let rowHeight = Math.max(6, maxLines * 3.6 + 2);
    const imageBoxes: Record<string, { width: number; height: number }> = {};
    if (row.images) {
      Object.entries(row.images).forEach(([key, img]) => {
        const colIndex = columns.findIndex((c) => c.key === key);
        const availableW = colIndex >= 0 ? colWidths[colIndex] - 2 : 30;
        const box = computeImageBox(doc, img.bytes, img.maxWidthMm ?? availableW, img.maxHeightMm ?? 28);
        imageBoxes[key] = box;
        rowHeight = Math.max(rowHeight, box.height + 2);
      });
    }

    const startedNewPage = ensureSpace(ctx, rowHeight);
    if (startedNewPage) drawHeader();

    const rowY = ctx.y;
    if (row.fill) {
      doc.setFillColor(...hexToRgb(row.fill));
      doc.rect(MARGIN, rowY, CONTENT_W, rowHeight, "F");
    }
    doc.setDrawColor(210);
    doc.rect(MARGIN, rowY, CONTENT_W, rowHeight);

    let x = MARGIN;
    columns.forEach((col, i) => {
      const img = row.images?.[col.key];
      if (img) {
        const box = imageBoxes[col.key];
        try {
          doc.addImage(img.bytes, imageFormat(img.mimeType), x + 1, rowY + 1, box.width, box.height);
        } catch {
          // imagen corrupta: se omite, la celda queda vacía en vez de romper el render.
        }
      } else {
        doc.setTextColor(0);
        doc.text(wrapped[col.key] ?? [], x + 1.5, rowY + 4);
      }
      x += colWidths[i];
      if (i < columns.length - 1) {
        doc.setDrawColor(230);
        doc.line(x, rowY, x, rowY + rowHeight);
      }
    });

    ctx.y += rowHeight;
  });

  ctx.y += 3;
}

function renderBlock(ctx: RenderContext, block: Block): void {
  switch (block.type) {
    case "text":
      renderText(ctx, block);
      break;
    case "keyValue":
      renderKeyValue(ctx, block);
      break;
    case "table":
      renderTable(ctx, block);
      break;
    case "image":
      renderImageBlock(ctx, block);
      break;
    case "chart":
      renderChart(ctx, block);
      break;
  }
}

/** Genera un PDF a partir del modelo genérico. Devuelve los bytes del archivo (no un Blob ni un objeto jsPDF: la app decide cómo entregarlo). */
export async function renderPdf(document: ReportDocument): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: RenderContext = { doc, y: MARGIN, firstPageUsed: false };

  if (document.showCoverPage !== false) {
    startNewPage(ctx);
    renderCoverPage(ctx, document);
  }

  document.sections.forEach((section) => {
    if (section.pageBreakBefore || !ctx.firstPageUsed) {
      startNewPage(ctx);
    } else {
      ctx.y += 4;
    }
    renderSectionHeading(ctx, section);
    section.blocks.forEach((block) => renderBlock(ctx, block));
  });

  if (document.footerTemplate) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const text = document.footerTemplate.replace("{page}", String(i)).replace("{total}", String(pageCount));
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(text, PAGE_W / 2, PAGE_H - 8, { align: "center" });
      doc.setTextColor(0);
    }
  }

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}
