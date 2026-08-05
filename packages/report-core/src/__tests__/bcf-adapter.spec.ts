import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseBcf } from "@bw-central/bcf-core";
import type { BcfProject } from "@bw-central/bcf-core";
import { bcfProjectToReportDocument, bcfProjectToCoordinationTable } from "../adapters/bcf";
import { renderPdf } from "../pdf/render";
import { renderExcel } from "../excel/render";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fixture BCF 2.1 REAL, no generada por este paquete - es la misma que usa
// packages/bcf-core (ver ese paquete para su procedencia: copiada del
// fixture real de bcf-pdf-exporter/test-fixtures/sample.bcf).
const FIXTURE_PATH = path.join(__dirname, "../../../bcf-core/src/__tests__/fixtures/sample-2.1.bcf");

async function loadRealBcfProject(): Promise<BcfProject> {
  const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
  return parseBcf(bytes);
}

describe("bcfProjectToReportDocument (layout por páginas)", () => {
  test("mapea un topic real parseado al modelo genérico correctamente", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToReportDocument(project, { projectName: "Reporte de prueba", author: "test@bwisebim.cl" });

    expect(doc.title).toBe("Reporte de prueba");
    expect(doc.author).toBe("test@bwisebim.cl");

    // 1 sección de analíticas + 1 por topic
    const topicSections = doc.sections.filter((s) => s.heading !== "Analíticas del reporte");
    expect(topicSections).toHaveLength(project.topics.length);

    const firstTopic = project.topics[0];
    const firstSection = topicSections[0];
    expect(firstSection.heading).toContain(firstTopic.title);
    expect(firstSection.pageBreakBefore).toBe(true);
  });

  test("preserva Priority/TopicStatus como string libre, tal cual viene del BCF (\"Alta\", no normalizado)", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToReportDocument(project);
    const topicSection = doc.sections.find((s) => s.heading?.includes("Interferencia"));
    expect(topicSection).toBeDefined();

    const kv = topicSection!.blocks.find((b) => b.type === "keyValue");
    expect(kv?.type).toBe("keyValue");
    if (kv?.type === "keyValue") {
      const priorityItem = kv.items.find((i) => i.label === "Prioridad");
      expect(priorityItem?.value).toBe("Alta");
    }
  });

  test("incluye la imagen del snapshot como bytes crudos cuando el topic tiene viewpoint con snapshot", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToReportDocument(project);
    const topicSection = doc.sections.find((s) => s.heading?.includes("Interferencia"));
    const imageBlock = topicSection?.blocks.find((b) => b.type === "image");
    expect(imageBlock).toBeDefined();
    if (imageBlock?.type === "image") {
      expect(imageBlock.bytes).toBeInstanceOf(Uint8Array);
      expect(imageBlock.bytes.length).toBeGreaterThan(0);
    }
  });

  test("la sección de analíticas incluye un chart por estado con datos reales del BCF", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToReportDocument(project);
    const analytics = doc.sections.find((s) => s.heading === "Analíticas del reporte");
    expect(analytics).toBeDefined();
    const statusChart = analytics!.blocks.find((b) => b.type === "chart" && b.title === "Distribución por Estado");
    expect(statusChart?.type).toBe("chart");
    if (statusChart?.type === "chart") {
      const total = statusChart.data.reduce((s, d) => s + d.value, 0);
      expect(total).toBe(project.topics.length);
    }
  });

  test("el documento resultante se renderiza a PDF sin errores", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToReportDocument(project, { projectName: "Reporte E2E" });
    const bytes = await renderPdf(doc);
    expect(bytes.length).toBeGreaterThan(0);
    expect(Buffer.from(bytes).toString("latin1").startsWith("%PDF-")).toBe(true);
  });

  test("el documento resultante se renderiza a Excel sin errores", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToReportDocument(project, { projectName: "Reporte E2E" });
    const bytes = await renderExcel(doc);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes));
    // analíticas + 1 hoja por topic
    expect(wb.worksheets.length).toBe(1 + project.topics.length);
  });
});

describe("bcfProjectToCoordinationTable (layout tabla compacta)", () => {
  test("produce una única Section 'Incidencias' con una fila por topic", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToCoordinationTable(project, { includeAnalytics: false });

    expect(doc.sections).toHaveLength(1);
    const table = doc.sections[0].blocks.find((b) => b.type === "table");
    expect(table?.type).toBe("table");
    if (table?.type === "table") {
      expect(table.rows).toHaveLength(project.topics.length);
      expect(table.rows[0].detail).toBeDefined();
    }
  });

  test("el Excel resultante tiene la hoja 'Incidencias' + una hoja de detalle por topic", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToCoordinationTable(project, { includeAnalytics: false });
    const bytes = await renderExcel(doc);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes));

    expect(wb.getWorksheet("Incidencias")).toBeDefined();
    expect(wb.worksheets.length).toBe(1 + project.topics.length);
  });

  test("el PDF resultante no crashea (tabla plana, sin las páginas de detalle)", async () => {
    const project = await loadRealBcfProject();
    const doc = bcfProjectToCoordinationTable(project, { includeAnalytics: false });
    await expect(renderPdf(doc)).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("adaptador BCF - casos límite", () => {
  test("un BcfProject sin topics no crashea ninguno de los dos layouts", () => {
    const empty: BcfProject = { version: "2.1", topics: [] };
    expect(() => bcfProjectToReportDocument(empty)).not.toThrow();
    expect(() => bcfProjectToCoordinationTable(empty)).not.toThrow();
  });

  test("bcfProjectToReportDocument con un proyecto vacío produce un documento renderizable (solo portada + analíticas)", async () => {
    const empty: BcfProject = { version: "2.1", topics: [] };
    const doc = bcfProjectToReportDocument(empty);
    await expect(renderPdf(doc)).resolves.toBeInstanceOf(Uint8Array);
    await expect(renderExcel(doc)).resolves.toBeInstanceOf(Uint8Array);
  });

  test("bcfProjectToCoordinationTable con un proyecto vacío produce una tabla sin filas, sin crashear", async () => {
    const empty: BcfProject = { version: "2.1", topics: [] };
    const doc = bcfProjectToCoordinationTable(empty, { includeAnalytics: false });
    await expect(renderExcel(doc)).resolves.toBeInstanceOf(Uint8Array);
  });

  test("un topic sin viewpoints ni comentarios no crashea", () => {
    const project: BcfProject = {
      version: "2.1",
      topics: [
        {
          guid: "t1",
          title: "Sin viewpoints",
          labels: [],
          creationDate: "2026-01-01T00:00:00Z",
          creationAuthor: "a@b.cl",
          referenceLinks: [],
          relatedTopics: [],
          comments: [],
          viewpoints: [],
        },
      ],
    };
    expect(() => bcfProjectToReportDocument(project)).not.toThrow();
    expect(() => bcfProjectToCoordinationTable(project)).not.toThrow();
  });
});
