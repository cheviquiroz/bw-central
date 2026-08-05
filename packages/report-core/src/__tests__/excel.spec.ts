import { describe, test, expect } from "vitest";
import ExcelJS from "exceljs";
import { renderExcel } from "../excel/render";
import type { ReportDocument } from "../model/document";

async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes));
  return wb;
}

function minimalDoc(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return { title: "Reporte de prueba", sections: [{ heading: "Sección 1", blocks: [] }], ...overrides };
}

describe("renderExcel", () => {
  test("produce un workbook válido, re-leíble por ExcelJS", async () => {
    const bytes = await renderExcel(minimalDoc());
    const wb = await loadWorkbook(bytes);
    expect(wb.worksheets.length).toBeGreaterThan(0);
  });

  test("una hoja por Section, nombrada según el heading", async () => {
    const doc: ReportDocument = {
      title: "Doc",
      sections: [
        { heading: "Primera", blocks: [] },
        { heading: "Segunda", blocks: [] },
      ],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Primera", "Segunda"]);
  });

  test("nombres de hoja se sanean (sin \\/?*[]:) y se deduplican", async () => {
    const doc: ReportDocument = {
      title: "Doc",
      sections: [
        { heading: "A/B?C*D", blocks: [] },
        { heading: "A/B?C*D", blocks: [] }, // mismo heading -> mismo nombre saneado -> debe deduplicarse
      ],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    const names = wb.worksheets.map((ws) => ws.name);
    expect(names[0]).toBe("A B C D");
    expect(names[1]).not.toBe(names[0]);
    expect(names[1]).toContain("A B C D");
  });

  test("la primera hoja incluye el banner del documento (título/autor/fecha)", async () => {
    const doc: ReportDocument = {
      title: "Título del Reporte",
      author: "chevi@bwisebim.cl",
      date: "2026-03-01T00:00:00Z",
      sections: [{ heading: "Sección", blocks: [] }],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    const ws = wb.worksheets[0];
    const cellValues = [];
    for (let r = 1; r <= 5; r++) cellValues.push(String(ws.getCell(r, 1).value ?? ""));
    expect(cellValues.join(" ")).toContain("Título del Reporte");
    expect(cellValues.join(" ")).toContain("chevi@bwisebim.cl");
  });

  test("TableBlock produce fila de encabezado + una fila por TableRow, con los valores correctos", async () => {
    const doc: ReportDocument = {
      title: "Doc",
      sections: [
        {
          heading: "Tabla",
          blocks: [
            {
              type: "table",
              columns: [
                { key: "nombre", header: "Nombre" },
                { key: "valor", header: "Valor" },
              ],
              rows: [
                { cells: { nombre: "Fila A", valor: 10 } },
                { cells: { nombre: "Fila B", valor: 20 } },
              ],
            },
          ],
        },
      ],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    const ws = wb.worksheets[0];

    // banner ausente (no es la primera hoja del documento en este caso, sí lo es -
    // buscamos la fila de encabezado por contenido, no por índice fijo, para no
    // acoplar el test al alto exacto del banner)
    const rows: string[][] = [];
    ws.eachRow((row) => {
      rows.push(row.values as unknown as string[]);
    });
    const headerRowIdx = rows.findIndex((r) => r.includes("Nombre"));
    expect(headerRowIdx).toBeGreaterThanOrEqual(0);
    const dataRow1 = rows[headerRowIdx + 1];
    const dataRow2 = rows[headerRowIdx + 2];
    expect(dataRow1).toContain("Fila A");
    expect(dataRow1).toContain(10);
    expect(dataRow2).toContain("Fila B");
    expect(dataRow2).toContain(20);
  });

  test("TableRow.detail genera una hoja de detalle aparte con un hyperlink desde la fila", async () => {
    const doc: ReportDocument = {
      title: "Doc",
      sections: [
        {
          heading: "Tabla",
          blocks: [
            {
              type: "table",
              columns: [{ key: "nombre", header: "Nombre" }],
              rows: [
                {
                  cells: { nombre: "Fila con detalle" },
                  detail: { label: "Detalle de Fila", blocks: [{ type: "text", text: "MARCADOR_DETALLE" }] },
                },
              ],
            },
          ],
        },
      ],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain("Detalle de Fila");

    const detailWs = wb.getWorksheet("Detalle de Fila")!;
    expect(String(detailWs.getCell(1, 1).value)).toBe("MARCADOR_DETALLE");

    const mainWs = wb.worksheets[0];
    let hyperlinkFound = false;
    mainWs.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && typeof cell.value === "object" && "hyperlink" in cell.value) {
          hyperlinkFound = true;
        }
      });
    });
    expect(hyperlinkFound).toBe(true);
  });

  test("KeyValueBlock produce filas label/value", async () => {
    const doc: ReportDocument = {
      title: "Doc",
      sections: [
        {
          heading: "Metadata",
          blocks: [{ type: "keyValue", items: [{ label: "Campo A", value: "Valor A" }] }],
        },
      ],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    const ws = wb.worksheets[0];
    let found = false;
    ws.eachRow((row) => {
      const values = row.values as unknown as string[];
      if (values.includes("Campo A") && values.includes("Valor A")) found = true;
    });
    expect(found).toBe(true);
  });

  test("ChartBlock cae a una tabla compacta label/valor (ExcelJS no dibuja gráficos nativos)", async () => {
    const doc: ReportDocument = {
      title: "Doc",
      sections: [
        {
          heading: "Analítica",
          blocks: [{ type: "chart", chartType: "barVertical", title: "Distribución", data: [{ label: "X", value: 5 }] }],
        },
      ],
    };
    const wb = await loadWorkbook(await renderExcel(doc));
    const ws = wb.worksheets[0];
    let found = false;
    ws.eachRow((row) => {
      const values = row.values as unknown as string[];
      if (values.includes("X") && values.includes(5)) found = true;
    });
    expect(found).toBe(true);
  });

  describe("casos límite", () => {
    test("documento sin secciones lanza un error claro (Excel exige al menos una hoja) en vez de un .xlsx corrupto silencioso", async () => {
      const doc: ReportDocument = { title: "Doc", sections: [] };
      await expect(renderExcel(doc)).rejects.toThrow();
    });

    test("tabla sin filas no crashea", async () => {
      const doc: ReportDocument = {
        title: "Doc",
        sections: [{ heading: "Vacía", blocks: [{ type: "table", columns: [{ key: "a", header: "A" }], rows: [] }] }],
      };
      await expect(renderExcel(doc)).resolves.toBeInstanceOf(Uint8Array);
    });

    test("imagen con bytes corruptos no crashea el render completo", async () => {
      const doc: ReportDocument = {
        title: "Doc",
        sections: [{ heading: "Img", blocks: [{ type: "image", bytes: new Uint8Array([9, 9, 9]), mimeType: "image/png" }] }],
      };
      await expect(renderExcel(doc)).resolves.toBeInstanceOf(Uint8Array);
    });

    test("texto muy largo no crashea", async () => {
      const longText = "Palabra ".repeat(5000);
      const doc: ReportDocument = { title: "Doc", sections: [{ heading: "Largo", blocks: [{ type: "text", text: longText }] }] };
      await expect(renderExcel(doc)).resolves.toBeInstanceOf(Uint8Array);
    });
  });
});
