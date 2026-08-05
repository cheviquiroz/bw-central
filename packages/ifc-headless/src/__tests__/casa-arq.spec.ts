import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile } from "../reader";
import type { IfcHeadlessDocument } from "../types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../../../oguc-core/fixtures/CASA-ARQ.ifc");

// Nombres/LongNames RAW, tal cual el volcado del inventario de la Parte 1
// (verificado contra los 49 espacios completos, no solo los primeros 30 -
// ver el resumen de esta tarea). CASA-ARQ no tiene ningún typo tipo
// "Sla Reuniones" como EOFF-SPC, pero sí tiene una inconsistencia real de
// abreviación: "cabina armadio" (3 espacios) vs "cab.armadio" (2
// espacios) para el mismo concepto - se verifica explícitamente abajo que
// NINGUNA de las dos formas se normaliza a la otra.
const EXPECTED_SPACES: { globalId: string; name: string; longName: string; description: string }[] = [
  { globalId: "0TnViz5BjEUPDWngIFJieF", name: "Vano 130613", longName: "disimpegno", description: "disimpegno" },
  { globalId: "13lFWb90rBGvNwZUGUZDrV", name: "Vano 130611", longName: "bagno", description: "bagno" },
  { globalId: "0BKxxPmq5748M94bALj9f6", name: "Vano 130606", longName: "garage", description: "garage" },
  { globalId: "3MXN9px0PFF9x$DnB3xMNv", name: "Vano 107056", longName: "cucina/pranzo", description: "cucina/pranzo" },
  { globalId: "3VBeA06Vf7gOcc$dIe_vND", name: "Vano 110235", longName: "cab.armadio", description: "cab.armadio" },
  { globalId: "3Hn4b73ZT3QwPscFfkA1Rh", name: "Vano 106530", longName: "cabina armadio", description: "cabina armadio" },
];

describe("ifc-headless: CASA-ARQ.ifc (IFC2X3, real fixture)", () => {
  let doc: IfcHeadlessDocument;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    doc = await readIfcFile(bytes);
  }, 30_000);

  test("schema is IFC2X3", () => {
    expect(doc.schema).toBe("IFC2X3");
  });

  test("returns exactly 49 spaces, matching the Part 1 inventory count", () => {
    expect(doc.spaces).toHaveLength(49);
  });

  test("units: length is bare METRE, area is SQUARE_METRE, volume is CUBIC_METRE", () => {
    expect(doc.units.length).toEqual({ name: "METRE", prefix: null });
    expect(doc.units.area).toEqual({ name: "SQUARE_METRE", prefix: null });
    expect(doc.units.volume).toEqual({ name: "CUBIC_METRE", prefix: null });
  });

  test("this file declares no IfcRelSpaceBoundary", () => {
    expect(doc.hasDeclaredSpaceBoundaries).toBe(false);
  });

  test("names/longNames/descriptions are byte-identical to the raw file for known spaces, including the cab.armadio/cabina armadio inconsistency - neither form is normalized to the other", () => {
    for (const expected of EXPECTED_SPACES) {
      const space = doc.spaces.find((s) => s.globalId === expected.globalId);
      expect(space, `space with GlobalId ${expected.globalId} not found`).toBeDefined();
      expect(space!.name).toBe(expected.name);
      expect(space!.longName).toBe(expected.longName);
      expect(space!.description).toBe(expected.description);
    }
  });

  test("ObjectType is null for every space (confirmed empty in the Part 1 inventory)", () => {
    for (const space of doc.spaces) {
      expect(space.objectType).toBeNull();
    }
  });

  test("quantity set is named literally \"BaseQuantities\" (not the buildingSMART-standard Qto_SpaceBaseQuantities), with raw unconverted metre values", () => {
    const space = doc.spaces.find((s) => s.globalId === "0TnViz5BjEUPDWngIFJieF")!;
    expect(Object.keys(space.quantitySets)).toContain("BaseQuantities");
    const qto = space.quantitySets["BaseQuantities"];

    expect(qto.GrossVolume.value).toBe("20.9076960001888");
    expect(qto.GrossVolume.ifcType).toBe("IFCQUANTITYVOLUME");
    expect(qto.GrossVolume.unit).toEqual({ name: "CUBIC_METRE", prefix: null });

    expect(qto.GrossPerimeter.value).toBe("11.0967054596543");
    expect(qto.GrossPerimeter.ifcType).toBe("IFCQUANTITYLENGTH");
    expect(qto.GrossPerimeter.unit).toEqual({ name: "METRE", prefix: null });

    expect(qto.GrossFloorArea.value).toBe("5.80769333338577");
    expect(qto.GrossFloorArea.ifcType).toBe("IFCQUANTITYAREA");
    expect(qto.GrossFloorArea.unit).toEqual({ name: "SQUARE_METRE", prefix: null });
  });

  test("property sets use this file's own non-standard vocabulary, not assumed buildingSMART names", () => {
    const space = doc.spaces.find((s) => s.globalId === "0TnViz5BjEUPDWngIFJieF")!;
    const psetNames = Object.keys(space.propertySets);
    // Al menos uno de los Pset custom reales encontrados en la Parte 1 debe aparecer.
    expect(psetNames.some((n) => n.startsWith("IFC_Pset_"))).toBe(true);
  });

  test("geometric boundary derivation on real spaces: finds at least one bounding wall, tagged 'inferred'", () => {
    // "Vano 130613" / disimpegno - primer espacio del archivo.
    const space = doc.spaces.find((s) => s.globalId === "0TnViz5BjEUPDWngIFJieF")!;
    expect(space.boundingElements.length).toBeGreaterThan(0);
    for (const ref of space.boundingElements) {
      expect(ref.method).toBe("inferred");
      expect(["high", "low"]).toContain(ref.confidence);
      expect(ref.ifcType).toMatch(/^Ifc(Wall|Window|Door)/);
    }
  });

  test("geometric boundary derivation: 3 manually-checked spaces each find at least one wall with high confidence", () => {
    // Verificado a mano contra el archivo (ver el resumen de esta tarea
    // para el detalle de la verificación): estos 3 espacios tienen una
    // geometría de space representativa y muros reales en la misma
    // planta que deberían solaparse con su AABB.
    const checkGlobalIds = ["0TnViz5BjEUPDWngIFJieF", "13lFWb90rBGvNwZUGUZDrV", "0BKxxPmq5748M94bALj9f6"];
    for (const globalId of checkGlobalIds) {
      const space = doc.spaces.find((s) => s.globalId === globalId)!;
      expect(space, `space ${globalId} not found`).toBeDefined();
      const walls = space.boundingElements.filter((r) => r.ifcType === "IfcWall");
      expect(walls.length, `space ${globalId} found no bounding walls`).toBeGreaterThan(0);
      expect(walls.some((w) => w.confidence === "high"), `space ${globalId} found no high-confidence wall`).toBe(true);
    }
  });

  test("no adjacency or boundary result claims 'authoritative' anywhere in this file (it has no IfcRelSpaceBoundary to be authoritative from)", () => {
    for (const space of doc.spaces) {
      expect(space.boundingElements.every((r) => r.method === "inferred")).toBe(true);
      expect(space.adjacentSpaces.every((r) => r.method === "inferred")).toBe(true);
    }
  });
});
