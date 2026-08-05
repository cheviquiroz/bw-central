import { describe, test, expect } from "vitest";
import { renderPdf } from "../pdf/render";
import type { ReportDocument } from "../model/document";

function pdfText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

/** Cuenta de páginas real, leída del propio diccionario /Pages del PDF (fuente de verdad del formato, no un conteo aproximado). */
function pdfPageCount(bytes: Uint8Array): number {
  const match = pdfText(bytes).match(/\/Type\s*\/Pages[\s\S]{0,300}?\/Count\s+(\d+)/);
  return match ? Number(match[1]) : -1;
}

function minimalDoc(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return {
    title: "Reporte de prueba",
    sections: [],
    ...overrides,
  };
}

describe("renderPdf", () => {
  test("produce un archivo PDF válido (firma %PDF- y %%EOF)", async () => {
    const bytes = await renderPdf(minimalDoc());
    const text = pdfText(bytes);
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  test("portada + N secciones con pageBreakBefore = N+1 páginas", async () => {
    const doc = minimalDoc({
      sections: [
        { heading: "Uno", blocks: [], pageBreakBefore: true },
        { heading: "Dos", blocks: [], pageBreakBefore: true },
        { heading: "Tres", blocks: [], pageBreakBefore: true },
      ],
    });
    const bytes = await renderPdf(doc);
    expect(pdfPageCount(bytes)).toBe(4); // portada + 3
  });

  test("showCoverPage: false omite la portada", async () => {
    const doc = minimalDoc({
      showCoverPage: false,
      sections: [{ heading: "Única sección", blocks: [], pageBreakBefore: true }],
    });
    const bytes = await renderPdf(doc);
    expect(pdfPageCount(bytes)).toBe(1);
  });

  test("secciones sin pageBreakBefore fluyen en la misma página", async () => {
    const doc = minimalDoc({
      showCoverPage: false,
      sections: [
        { heading: "A", blocks: [{ type: "text", text: "contenido corto" }] },
        { heading: "B", blocks: [{ type: "text", text: "otro contenido corto" }] },
      ],
    });
    const bytes = await renderPdf(doc);
    expect(pdfPageCount(bytes)).toBe(1);
  });

  test("el texto de los encabezados de sección aparece literalmente en el PDF", async () => {
    const doc = minimalDoc({
      sections: [{ heading: "MARCADOR_UNICO_ENCABEZADO", blocks: [{ type: "text", text: "MARCADOR_UNICO_CUERPO" }] }],
    });
    const bytes = await renderPdf(doc);
    const text = pdfText(bytes);
    expect(text).toContain("MARCADOR_UNICO_ENCABEZADO");
    expect(text).toContain("MARCADOR_UNICO_CUERPO");
  });

  test("footerTemplate reemplaza {page} y {total}, sin dejar los tokens literales", async () => {
    const doc = minimalDoc({
      footerTemplate: "Doc — Página {page} de {total}",
      sections: [
        { heading: "Uno", blocks: [], pageBreakBefore: true },
        { heading: "Dos", blocks: [], pageBreakBefore: true },
      ],
    });
    const bytes = await renderPdf(doc);
    const text = pdfText(bytes);
    expect(text).not.toContain("{page}");
    expect(text).not.toContain("{total}");
    expect(text).toContain("Página 1 de 3"); // portada=1, Uno=2, Dos=3
  });

  test("sin footerTemplate no se agrega texto de pie de página", async () => {
    const doc = minimalDoc();
    const bytes = await renderPdf(doc);
    expect(pdfText(bytes)).not.toContain("Página");
  });

  describe("casos límite", () => {
    test("documento sin secciones no crashea (solo portada)", async () => {
      const bytes = await renderPdf(minimalDoc());
      expect(pdfPageCount(bytes)).toBe(1);
    });

    test("tabla sin filas no crashea", async () => {
      const doc = minimalDoc({
        sections: [{ heading: "Tabla vacía", blocks: [{ type: "table", columns: [{ key: "a", header: "A" }], rows: [] }] }],
      });
      await expect(renderPdf(doc)).resolves.toBeInstanceOf(Uint8Array);
    });

    test("gráfico sin datos no crashea", async () => {
      const doc = minimalDoc({
        sections: [{ heading: "Gráfico vacío", blocks: [{ type: "chart", chartType: "donut", data: [] }] }],
      });
      await expect(renderPdf(doc)).resolves.toBeInstanceOf(Uint8Array);
    });

    test("imagen con bytes corruptos no crashea (se omite, no rompe el render)", async () => {
      const doc = minimalDoc({
        sections: [
          {
            heading: "Imagen corrupta",
            blocks: [{ type: "image", bytes: new Uint8Array([1, 2, 3, 4]), mimeType: "image/png" }],
          },
        ],
      });
      await expect(renderPdf(doc)).resolves.toBeInstanceOf(Uint8Array);
    });

    test("texto muy largo se pagina automáticamente sin crashear", async () => {
      const longText = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(400);
      const doc = minimalDoc({
        showCoverPage: false,
        sections: [{ heading: "Texto largo", blocks: [{ type: "text", text: longText }], pageBreakBefore: true }],
      });
      const bytes = await renderPdf(doc);
      expect(pdfPageCount(bytes)).toBeGreaterThan(1);
    });

    test("todos los tipos de gráfico (pie/donut/barVertical/barHorizontal) renderizan sin crashear", async () => {
      const data = [
        { label: "A", value: 3 },
        { label: "B", value: 7, color: "#FF0000" },
      ];
      for (const chartType of ["pie", "donut", "barVertical", "barHorizontal"] as const) {
        const doc = minimalDoc({ sections: [{ heading: chartType, blocks: [{ type: "chart", chartType, data }] }] });
        await expect(renderPdf(doc)).resolves.toBeInstanceOf(Uint8Array);
      }
    });
  });
});
