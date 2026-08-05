// Adaptador BCF -> modelo genérico de reporte. Es el ÚNICO archivo de
// report-core que sabe qué es un BcfTopic - el resto del paquete (model/,
// pdf/, excel/) no importa nada de @bw-central/bcf-core ni conoce ningún
// concepto BCF.
//
// TENSIÓN REAL ENCONTRADA (documentada, no escondida): las dos
// generaciones originales tenían formas de reporte genuinamente distintas
// para los MISMOS datos BCF - pdfGenerator.js dedicaba una página completa
// por topic (rica: metadata, descripción, imagen, cámara/clipping/
// selección/coloring, comentarios), mientras que xlsxGenerator.js volcaba
// TODOS los topics como filas de una sola tabla compacta, con una hoja de
// detalle aparte por topic solo para la imagen grande. Forzar una única
// forma de documento a servir bien a los dos formatos habría significado
// sacrificar a uno de los dos - en vez de eso, se exponen dos funciones
// separadas, construidas sobre los mismos bloques genéricos compartidos:
//
// - bcfProjectToReportDocument(): layout "por páginas", una Section rica
//   por topic (pageBreakBefore + accentColor por estado) - calza muy bien
//   con el PDF original, razonablemente con Excel (una hoja por topic).
// - bcfProjectToCoordinationTable(): layout "tabla compacta", una sola
//   Section con un TableBlock (una fila por topic, miniatura embebida,
//   TableRow.detail con el mismo contenido rico) - reproduce casi exacto
//   el Coordination Report + hojas de detalle del Excel original; en PDF
//   se ve como una tabla plana (el renderer PDF ignora TableRow.detail,
//   ver pdf/render.ts), perdiendo la riqueza por-página pero sin romper.

import type { BcfProject, BcfTopic, BcfViewpoint, BcfVector3 } from "@bw-central/bcf-core";
import type { Block, ChartDataPoint, ImageBlock, ReportDocument, Section, TableRow } from "../model/document";

export interface BcfReportOptions {
  projectName?: string;
  author?: string;
  includeCover?: boolean;
  includeAnalytics?: boolean;
  includeTechnicalMetadata?: boolean;
  logo?: { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" };
}

const STATUS_COLOR: Record<string, string> = {
  Open: "#DC3545",
  Active: "#DC3545",
  "In Progress": "#FFC107",
  Resolved: "#28A745",
  Closed: "#6C757D",
};

function statusColor(status: string | undefined): string {
  return STATUS_COLOR[status ?? ""] ?? "#464646";
}

function fmtVec(v: BcfVector3 | undefined): string {
  if (!v) return "—";
  return `X: ${v.x.toFixed(3)}  Y: ${v.y.toFixed(3)}  Z: ${v.z.toFixed(3)}`;
}

function fmtDate(d: string | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString("es-CL");
}

function snapshotImage(vp: BcfViewpoint | undefined, maxWidthMm: number, maxHeightMm: number): ImageBlock | undefined {
  if (!vp?.snapshot) return undefined;
  return {
    type: "image",
    bytes: vp.snapshot,
    mimeType: vp.snapshotMimeType === "image/jpeg" ? "image/jpeg" : "image/png",
    maxWidthMm,
    maxHeightMm,
  };
}

/** Bloques de metadata técnica del viewpoint (cámara, clipping planes, selección, coloring) - compartidos entre ambos layouts. */
function buildTechnicalMetadataBlocks(vp: BcfViewpoint): Block[] {
  const blocks: Block[] = [];

  if (vp.camera) {
    const items = [
      { label: `Cámara`, value: vp.camera.type },
      { label: "Posición", value: fmtVec(vp.camera.viewPoint) },
      { label: "Dirección", value: fmtVec(vp.camera.direction) },
      { label: "Vector superior", value: fmtVec(vp.camera.upVector) },
    ];
    if (vp.camera.fieldOfView !== undefined) {
      items.push({ label: "FOV", value: `${Math.round(vp.camera.fieldOfView * 10) / 10}°` });
    }
    blocks.push({ type: "text", style: "subheading", text: "Metadata técnica del viewpoint" });
    blocks.push({ type: "keyValue", items });
  }

  if (vp.clippingPlanes.length) {
    blocks.push({ type: "text", style: "caption", text: `Planos de corte (${vp.clippingPlanes.length})` });
    blocks.push({
      type: "table",
      columns: [
        { key: "plano", header: "Plano", width: 8 },
        { key: "ubicacion", header: "Ubicación", width: 25 },
        { key: "direccion", header: "Dirección", width: 25 },
      ],
      rows: vp.clippingPlanes.map((cp, i) => ({
        cells: { plano: `#${i + 1}`, ubicacion: fmtVec(cp.location), direccion: fmtVec(cp.direction) },
      })),
    });
  }

  if (vp.components.selection.length) {
    blocks.push({ type: "text", style: "caption", text: `Componentes IFC seleccionados (${vp.components.selection.length})` });
    blocks.push({
      type: "table",
      columns: [
        { key: "guid", header: "IFC GUID", width: 30 },
        { key: "sistema", header: "Sistema de origen", width: 15 },
      ],
      rows: vp.components.selection.map((c) => ({ cells: { guid: c.ifcGuid, sistema: c.originatingSystem ?? "—" } })),
    });
  }

  if (vp.components.coloring.length) {
    blocks.push({ type: "text", style: "caption", text: `Grupos de color (${vp.components.coloring.length})` });
    blocks.push({
      type: "table",
      columns: [
        { key: "color", header: "Color", width: 10 },
        { key: "cantidad", header: "Componentes", width: 10 },
      ],
      rows: vp.components.coloring.map((g) => ({
        cells: { color: `#${g.color}`, cantidad: g.components.length },
        fill: `#${g.color}`,
      })),
    });
  }

  return blocks;
}

/** Bloques completos de un topic (metadata, descripción, imagen, técnica, comentarios) - el contenido "rico", compartido entre ambos layouts. */
function buildTopicDetailBlocks(topic: BcfTopic, opts: { includeTechnicalMetadata: boolean; imageMaxWidthMm: number; imageMaxHeightMm: number }): Block[] {
  const blocks: Block[] = [];

  blocks.push({
    type: "keyValue",
    columns: 2,
    items: [
      { label: "Estado", value: topic.topicStatus || "—" },
      { label: "Autor", value: topic.creationAuthor || "—" },
      { label: "Tipo", value: topic.topicType || "—" },
      { label: "Creado", value: fmtDate(topic.creationDate) },
      { label: "Prioridad", value: topic.priority || "—" },
      { label: "Asignado a", value: topic.assignedTo || "—" },
      { label: "Etapa", value: topic.stage || "—" },
      { label: "Modificado", value: fmtDate(topic.modifiedDate) },
    ],
  });

  if (topic.labels.length) {
    blocks.push({ type: "text", style: "caption", text: `Etiquetas: ${topic.labels.join(", ")}` });
  }

  blocks.push({ type: "text", style: "subheading", text: "Descripción" });
  blocks.push({ type: "text", text: topic.description || "Sin descripción." });

  const image = snapshotImage(topic.viewpoints[0], opts.imageMaxWidthMm, opts.imageMaxHeightMm);
  if (image) blocks.push(image);

  if (opts.includeTechnicalMetadata && topic.viewpoints[0]) {
    blocks.push(...buildTechnicalMetadataBlocks(topic.viewpoints[0]));
  }

  if (topic.comments.length) {
    blocks.push({ type: "text", style: "subheading", text: `Comentarios (${topic.comments.length})` });
    topic.comments.forEach((c) => {
      blocks.push({ type: "text", style: "caption", text: `${c.author || "Anónimo"} — ${fmtDate(c.date)}` });
      blocks.push({ type: "text", text: c.text || "" });
    });
  }

  return blocks;
}

function toChartData(counts: Record<string, number>, colorFor?: (label: string) => string | undefined): ChartDataPoint[] {
  return Object.entries(counts).map(([label, value]) => ({ label, value, color: colorFor?.(label) }));
}

function computeAnalytics(topics: BcfTopic[]) {
  const statusCount: Record<string, number> = {};
  const priorityCount: Record<string, number> = {};
  const typeCount: Record<string, number> = {};
  const labelCount: Record<string, number> = {};
  const authorCount: Record<string, number> = {};
  let totalComments = 0;

  topics.forEach((t) => {
    const status = t.topicStatus || "Sin estado";
    statusCount[status] = (statusCount[status] || 0) + 1;
    const priority = t.priority || "Sin prioridad";
    priorityCount[priority] = (priorityCount[priority] || 0) + 1;
    const topicType = t.topicType || "Sin tipo";
    typeCount[topicType] = (typeCount[topicType] || 0) + 1;
    const author = t.creationAuthor || "Desconocido";
    authorCount[author] = (authorCount[author] || 0) + 1;
    t.labels.forEach((l) => {
      if (l) labelCount[l] = (labelCount[l] || 0) + 1;
    });
    totalComments += t.comments.length;
  });

  return {
    statusCount,
    priorityCount,
    typeCount,
    labelCount,
    authorCount,
    totalComments,
    totalTopics: topics.length,
    avgComments: topics.length ? totalComments / topics.length : 0,
  };
}

function buildAnalyticsSection(project: BcfProject): Section {
  const analytics = computeAnalytics(project.topics);
  const blocks: Block[] = [
    {
      type: "keyValue",
      columns: 2,
      items: [
        { label: "Total topics", value: String(analytics.totalTopics) },
        { label: "Total comentarios", value: String(analytics.totalComments) },
        { label: "Promedio comentarios/topic", value: analytics.avgComments.toFixed(1) },
        { label: "Versión BCF", value: project.version },
      ],
    },
    { type: "chart", chartType: "donut", title: "Distribución por Estado", data: toChartData(analytics.statusCount, statusColor) },
    { type: "chart", chartType: "barVertical", title: "Distribución por Prioridad", data: toChartData(analytics.priorityCount) },
    { type: "chart", chartType: "barVertical", title: "Distribución por Tipo", data: toChartData(analytics.typeCount) },
  ];

  if (Object.keys(analytics.labelCount).length) {
    blocks.push({ type: "chart", chartType: "barVertical", title: "Distribución por Especialidad", data: toChartData(analytics.labelCount) });
  }

  const topAuthors = Object.entries(analytics.authorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));
  blocks.push({ type: "chart", chartType: "barHorizontal", title: "Actividad por Autor", data: topAuthors });

  return { heading: "Analíticas del reporte", blocks, pageBreakBefore: true };
}

function baseDocument(project: BcfProject, options: BcfReportOptions): Omit<ReportDocument, "sections"> {
  const { projectName = "Reporte BCF", author = "", includeCover = true, logo } = options;
  return {
    title: projectName,
    subtitle: "Reporte de coordinación BCF",
    author,
    logo: logo ? { type: "image", bytes: logo.bytes, mimeType: logo.mimeType, maxWidthMm: 90, maxHeightMm: 45 } : undefined,
    footerTemplate: `${projectName} — Página {page} de {total}`,
    showCoverPage: includeCover,
  };
}

/**
 * Layout "por páginas": una Section rica por topic, con salto de página y
 * acento de color por estado - reconstruye el reporte PDF original casi
 * exactamente (ver pdfGenerator.js). En Excel produce una hoja por topic
 * (razonable, pero distinto del Coordination Report compacto original -
 * para eso, ver bcfProjectToCoordinationTable).
 */
export function bcfProjectToReportDocument(project: BcfProject, options: BcfReportOptions = {}): ReportDocument {
  const { includeAnalytics = true, includeTechnicalMetadata = true } = options;
  const sections: Section[] = [];

  if (includeAnalytics) {
    sections.push(buildAnalyticsSection(project));
  }

  project.topics.forEach((topic, idx) => {
    sections.push({
      heading: `${idx + 1}. ${topic.title || "(sin título)"}`,
      accentColor: statusColor(topic.topicStatus),
      pageBreakBefore: true,
      blocks: buildTopicDetailBlocks(topic, { includeTechnicalMetadata, imageMaxWidthMm: 126, imageMaxHeightMm: 70 }),
    });
  });

  return { ...baseDocument(project, options), sections };
}

/**
 * Layout "tabla compacta": una sola Section con un TableBlock, una fila por
 * topic (miniatura embebida + link a una hoja de detalle) - reproduce casi
 * exacto el "Coordination Report" + hojas por topic del Excel original
 * (ver xlsxGenerator.js). En PDF se ve como una tabla plana (el renderer
 * ignora TableRow.detail), sin las páginas ricas por topic.
 */
export function bcfProjectToCoordinationTable(project: BcfProject, options: BcfReportOptions = {}): ReportDocument {
  const { includeAnalytics = true, includeTechnicalMetadata = true } = options;
  const sections: Section[] = [];

  if (includeAnalytics) {
    sections.push(buildAnalyticsSection(project));
  }

  const rows: TableRow[] = project.topics.map((topic, idx) => {
    const thumbnail = snapshotImage(topic.viewpoints[0], 40, 26);
    const row: TableRow = {
      cells: {
        num: idx + 1,
        id: topic.guid ? topic.guid.slice(0, 8) : "",
        fecha: fmtDate(topic.creationDate),
        titulo: topic.title || "(sin título)",
        especialidad: topic.labels.join(", "),
        estado: topic.topicStatus || "",
        prioridad: topic.priority || "",
        autor: topic.creationAuthor || "",
        comentarios: topic.comments.map((c) => `${c.author || "Anónimo"} (${fmtDate(c.date)}): ${c.text}`).join("\n\n"),
      },
      fill: topic.topicStatus ? statusColor(topic.topicStatus) : undefined,
      images: thumbnail ? { imagen: thumbnail } : undefined,
      detail: {
        label: `${idx + 1}. ${topic.title || "(sin título)"}`,
        blocks: buildTopicDetailBlocks(topic, { includeTechnicalMetadata, imageMaxWidthMm: 180, imageMaxHeightMm: 110 }),
      },
    };
    return row;
  });

  sections.push({
    heading: "Incidencias",
    pageBreakBefore: true,
    blocks: [
      {
        type: "table",
        columns: [
          { key: "num", header: "N°", width: 6 },
          { key: "id", header: "ID", width: 12 },
          { key: "fecha", header: "Fecha", width: 16 },
          { key: "titulo", header: "Título", width: 32 },
          { key: "especialidad", header: "Especialidad", width: 18 },
          { key: "imagen", header: "Imagen", width: 40 },
          { key: "estado", header: "Estado", width: 12 },
          { key: "prioridad", header: "Prioridad", width: 12 },
          { key: "autor", header: "Autor", width: 24 },
          { key: "comentarios", header: "Comentarios", width: 45 },
        ],
        rows,
      },
    ],
  });

  return { ...baseDocument(project, options), sections };
}
