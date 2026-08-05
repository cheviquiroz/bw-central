// Modelo genérico -> Excel (ExcelJS). Una hoja por Section (nombre
// saneado/deduplicado), más una hoja de detalle por cada TableRow.detail -
// mismo patrón que el "Coordination Report + hoja por topic" original
// (xlsxGenerator.js), generalizado: el renderer no sabe qué hay dentro de
// una fila, solo sabe volcar columnas/celdas/imágenes/links.
//
// ExcelJS es Node-friendly de por sí (confirmado: wb.addImage acepta un
// Uint8Array/Buffer crudo, no hace falta base64 ni DOM) - ver el resumen
// del commit que agrega este paquete.

import ExcelJS from "exceljs";
import type { ReportDocument, Block, TextBlock, KeyValueBlock, TableBlock, ImageBlock, ChartBlock, Color } from "../model/document";
import { readPngDimensions } from "../shared/imageDimensions";

const HEADER_FILL = "FF1F2937";
const HEADER_FONT_COLOR = "FFFFFFFF";
const LINK_COLOR = "FF2563EB";
const CAPTION_COLOR = "FF9CA3AF";

const BORDER_ALL = {
  top: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
  left: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
  bottom: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
  right: { style: "thin" as const, color: { argb: "FFD0D0D0" } },
};

function toArgb(color: Color): string {
  return `FF${color.replace(/^#/, "").toUpperCase()}`;
}

/**
 * ExcelJS.Image tipa `buffer` como `Buffer`, pero su propia definición de
 * `Buffer` (o la de @types/node resuelta en este workspace) no es
 * estructuralmente idéntica a la que produce `Buffer.from()` acá (choque de
 * generics `Buffer<ArrayBufferLike>` entre versiones/duplicados de
 * @types/node vía pnpm) - confirmado empíricamente que un Buffer real
 * funciona sin problema en runtime (ver el resumen del commit que agrega
 * este paquete); el `any` acá es deliberado, acotado a este único punto de
 * fricción entre libraries, no una salida general de todo el archivo.
 */
// Sin anotación de retorno a propósito: declararla como `Buffer` reintroduce
// el choque de tipos en cada call site (la comprobación de asignabilidad
// ocurre ahí, no dentro de esta función) - `any` es la salida real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toExcelBuffer(bytes: Uint8Array): any {
  return Buffer.from(bytes);
}

/** ExcelJS posiciona imágenes en px; el modelo expresa límites en mm (pensados para PDF). 96dpi es la densidad convencional de pantalla/Excel. */
function mmToPx(mm: number, dpi = 96): number {
  return Math.round((mm / 25.4) * dpi);
}

const DEFAULT_IMG_MAX_W_PX = 260;
const DEFAULT_IMG_MAX_H_PX = 170;

function computeImageBoxPx(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/jpeg",
  maxW: number,
  maxH: number
): { width: number; height: number } {
  if (mimeType === "image/png") {
    const dims = readPngDimensions(bytes);
    if (dims) {
      let w = maxW;
      let h = Math.round((dims.height * w) / dims.width);
      if (h > maxH) {
        h = maxH;
        w = Math.round((dims.width * h) / dims.height);
      }
      return { width: w, height: h };
    }
  }
  // JPEG, o PNG sin header reconocible: mismo fallback que usaba el
  // original en Node (sin poder determinar dimensiones reales).
  return { width: maxW, height: Math.round(maxW * 0.62) };
}

const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g;

/** Nombre de hoja válido para Excel (sin \\/?*[]:, máx 31 chars), deduplicado dentro del workbook. */
function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  const base = name.replace(INVALID_SHEET_CHARS, " ").trim().slice(0, 31) || "Hoja";
  let candidate = base;
  let n = 2;
  while (usedNames.has(candidate)) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  usedNames.add(candidate);
  return candidate;
}

interface SheetCursor {
  row: number;
}

interface DetailSheetRequest {
  sheetName: string;
  blocks: Block[];
}

function renderDocumentBanner(ws: ExcelJS.Worksheet, doc: ReportDocument, cursor: SheetCursor): void {
  const titleCell = ws.getCell(cursor.row, 1);
  titleCell.value = doc.title;
  titleCell.font = { size: 16, bold: true };
  ws.getRow(cursor.row).height = 28;
  cursor.row++;

  if (doc.subtitle) {
    const cell = ws.getCell(cursor.row, 1);
    cell.value = doc.subtitle;
    cell.font = { italic: true, color: { argb: CAPTION_COLOR } };
    cursor.row++;
  }
  if (doc.author) {
    ws.getCell(cursor.row, 1).value = `Autor: ${doc.author}`;
    cursor.row++;
  }
  const dateVal = doc.date ? new Date(doc.date) : new Date();
  const dateText = Number.isNaN(dateVal.getTime()) ? String(doc.date) : dateVal.toLocaleString("es-CL");
  ws.getCell(cursor.row, 1).value = `Generado: ${dateText}`;
  cursor.row += 2;
}

function renderTextToSheet(ws: ExcelJS.Worksheet, block: TextBlock, cursor: SheetCursor): void {
  const cell = ws.getCell(cursor.row, 1);
  cell.value = block.text;
  cell.alignment = { wrapText: true, vertical: "top" };
  if (block.style === "heading") cell.font = { size: 13, bold: true };
  else if (block.style === "subheading") cell.font = { size: 11, bold: true };
  else if (block.style === "caption") cell.font = { size: 9, italic: true, color: { argb: CAPTION_COLOR } };
  cursor.row += 2;
}

function renderKeyValueToSheet(ws: ExcelJS.Worksheet, block: KeyValueBlock, cursor: SheetCursor): void {
  const columns = block.columns ?? 1;

  if (columns === 1) {
    block.items.forEach(({ label, value }) => {
      ws.getCell(cursor.row, 1).value = label;
      ws.getCell(cursor.row, 1).font = { bold: true };
      ws.getCell(cursor.row, 2).value = value;
      cursor.row++;
    });
  } else {
    for (let i = 0; i < block.items.length; i += 2) {
      const left = block.items[i];
      const right = block.items[i + 1];
      ws.getCell(cursor.row, 1).value = left.label;
      ws.getCell(cursor.row, 1).font = { bold: true };
      ws.getCell(cursor.row, 2).value = left.value;
      if (right) {
        ws.getCell(cursor.row, 3).value = right.label;
        ws.getCell(cursor.row, 3).font = { bold: true };
        ws.getCell(cursor.row, 4).value = right.value;
      }
      cursor.row++;
    }
  }
  cursor.row++;
}

function renderImageToSheet(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, block: ImageBlock, cursor: SheetCursor): void {
  const maxW = block.maxWidthMm ? mmToPx(block.maxWidthMm) : DEFAULT_IMG_MAX_W_PX;
  const maxH = block.maxHeightMm ? mmToPx(block.maxHeightMm) : DEFAULT_IMG_MAX_H_PX;
  const box = computeImageBoxPx(block.bytes, block.mimeType, maxW, maxH);

  const imgId = wb.addImage({ buffer: toExcelBuffer(block.bytes), extension: block.mimeType === "image/jpeg" ? "jpeg" : "png" });
  ws.addImage(imgId, { tl: { col: 0.1, row: cursor.row - 1 + 0.1 }, ext: { width: box.width, height: box.height } });

  const rowsSpanned = Math.max(1, Math.ceil(box.height / 20));
  cursor.row += rowsSpanned + 1;

  if (block.caption) {
    const cell = ws.getCell(cursor.row, 1);
    cell.value = block.caption;
    cell.font = { italic: true, size: 9, color: { argb: CAPTION_COLOR } };
    cursor.row++;
  }
  cursor.row++;
}

/**
 * ExcelJS no expone gráficos nativos y xlsxGenerator.js nunca dibujó
 * ninguno (no había nada que portar) - se vuelca como tabla compacta
 * label/valor en vez de descartar el contenido en silencio.
 */
function renderChartAsTable(ws: ExcelJS.Worksheet, block: ChartBlock, cursor: SheetCursor): void {
  if (block.title) {
    const cell = ws.getCell(cursor.row, 1);
    cell.value = block.title;
    cell.font = { bold: true };
    cursor.row++;
  }
  ws.getCell(cursor.row, 1).value = "Etiqueta";
  ws.getCell(cursor.row, 1).font = { bold: true };
  ws.getCell(cursor.row, 2).value = "Valor";
  ws.getCell(cursor.row, 2).font = { bold: true };
  cursor.row++;

  block.data.forEach((point) => {
    ws.getCell(cursor.row, 1).value = point.label;
    ws.getCell(cursor.row, 2).value = point.value;
    cursor.row++;
  });
  cursor.row++;
}

function renderTableToSheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  block: TableBlock,
  cursor: SheetCursor,
  usedNames: Set<string>,
  detailQueue: DetailSheetRequest[]
): void {
  if (block.columns.length === 0) return;

  block.columns.forEach((col, i) => {
    const column = ws.getColumn(i + 1);
    column.width = Math.max(column.width ?? 0, col.width ?? 20);
  });
  const hasDetail = block.rows.some((r) => r.detail);
  const linkColIndex = block.columns.length + 1;
  if (hasDetail) ws.getColumn(linkColIndex).width = 16;

  const headerRow = ws.getRow(cursor.row);
  block.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER_ALL;
  });
  if (hasDetail) {
    const linkHeader = headerRow.getCell(linkColIndex);
    linkHeader.value = "Detalle";
    linkHeader.font = { bold: true, color: { argb: HEADER_FONT_COLOR } };
    linkHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    linkHeader.border = BORDER_ALL;
  }
  headerRow.height = 22;
  cursor.row++;

  block.rows.forEach((row) => {
    const rowIdx = cursor.row;
    const excelRow = ws.getRow(rowIdx);
    let rowHeightPx = 40;

    block.columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.border = BORDER_ALL;
      const img = row.images?.[col.key];
      if (!img) {
        cell.value = row.cells[col.key] ?? "";
        cell.alignment = { vertical: "top", wrapText: true };
        if (row.fill) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(row.fill) } };
        }
      }
    });

    if (row.images) {
      Object.entries(row.images).forEach(([key, img]) => {
        const colIndex = block.columns.findIndex((c) => c.key === key);
        if (colIndex === -1) return;
        const maxW = img.maxWidthMm ? mmToPx(img.maxWidthMm) : DEFAULT_IMG_MAX_W_PX;
        const maxH = img.maxHeightMm ? mmToPx(img.maxHeightMm) : DEFAULT_IMG_MAX_H_PX;
        const box = computeImageBoxPx(img.bytes, img.mimeType, maxW, maxH);
        const imgId = wb.addImage({ buffer: toExcelBuffer(img.bytes), extension: img.mimeType === "image/jpeg" ? "jpeg" : "png" });
        ws.addImage(imgId, {
          tl: { col: colIndex + 0.05, row: rowIdx - 1 + 0.05 },
          ext: { width: box.width, height: box.height },
        });
        rowHeightPx = Math.max(rowHeightPx, box.height + 15);
      });
    }

    if (row.detail) {
      const sheetName = sanitizeSheetName(row.detail.label, usedNames);
      detailQueue.push({ sheetName, blocks: row.detail.blocks });
      const linkCell = excelRow.getCell(linkColIndex);
      linkCell.value = { text: "Ver detalle →", hyperlink: `#'${sheetName}'!A1` };
      linkCell.font = { color: { argb: LINK_COLOR }, underline: true };
      linkCell.alignment = { vertical: "top", horizontal: "center" };
      linkCell.border = BORDER_ALL;
    }

    excelRow.height = Math.round(rowHeightPx * 0.75); // Excel usa puntos, no px: 1px @96dpi ≈ 0.75pt
    cursor.row++;
  });

  cursor.row += 2;
}

function renderBlockToSheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  block: Block,
  cursor: SheetCursor,
  usedNames: Set<string>,
  detailQueue: DetailSheetRequest[]
): void {
  switch (block.type) {
    case "text":
      renderTextToSheet(ws, block, cursor);
      break;
    case "keyValue":
      renderKeyValueToSheet(ws, block, cursor);
      break;
    case "table":
      renderTableToSheet(wb, ws, block, cursor, usedNames, detailQueue);
      break;
    case "image":
      renderImageToSheet(wb, ws, block, cursor);
      break;
    case "chart":
      renderChartAsTable(ws, block, cursor);
      break;
  }
}

/** Genera un workbook Excel a partir del modelo genérico. Devuelve los bytes del archivo .xlsx. */
export async function renderExcel(document: ReportDocument): Promise<Uint8Array> {
  // ExcelJS no valida esto por su cuenta: escribe felizmente un .xlsx con
  // cero hojas (confirmado empíricamente), que Excel real después no puede
  // abrir - un error claro acá es mejor que un archivo silenciosamente roto.
  if (document.sections.length === 0) {
    throw new Error("No se puede generar un Excel sin ninguna Section: un workbook necesita al menos una hoja.");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = document.author || "report-core";
  wb.created = document.date ? new Date(document.date) : new Date();

  const usedNames = new Set<string>();
  const detailQueue: DetailSheetRequest[] = [];

  document.sections.forEach((section, index) => {
    const sheetName = sanitizeSheetName(section.heading || `Sección ${index + 1}`, usedNames);
    const ws = wb.addWorksheet(sheetName, { pageSetup: { orientation: "landscape", fitToPage: true } });
    const cursor: SheetCursor = { row: 1 };

    if (index === 0) {
      renderDocumentBanner(ws, document, cursor);
    }

    if (section.heading) {
      const cell = ws.getCell(cursor.row, 1);
      cell.value = section.heading;
      cell.font = { size: 13, bold: true };
      cursor.row += 2;
    }

    section.blocks.forEach((block) => renderBlockToSheet(wb, ws, block, cursor, usedNames, detailQueue));
  });

  // Las hojas de detalle se crean después de recorrer todas las secciones,
  // para poder deduplicar nombres contra TODAS las hojas del workbook
  // (secciones + detalle) sin depender del orden en que aparecen. Loop por
  // índice (no forEach) a propósito: un detalle puede a su vez contener una
  // tabla con más detalle anidado, que empuja NUEVOS elementos a
  // detailQueue mientras se recorre - forEach no garantiza visitar
  // elementos agregados durante su propia iteración, un while con length
  // reevaluado en cada vuelta sí.
  let detailIndex = 0;
  while (detailIndex < detailQueue.length) {
    const { sheetName, blocks } = detailQueue[detailIndex];
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
    const cursor: SheetCursor = { row: 1 };
    blocks.forEach((block) => renderBlockToSheet(wb, ws, block, cursor, usedNames, detailQueue));
    detailIndex++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
