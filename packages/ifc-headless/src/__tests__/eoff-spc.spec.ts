import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile } from "../reader";
import type { IfcHeadlessDocument } from "../types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../../../oguc-core/fixtures/EOFF-SPC-IFC-I01.ifc");

describe("ifc-headless: EOFF-SPC-IFC-I01.ifc (IFC4, real fixture)", () => {
  let doc: IfcHeadlessDocument;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    doc = await readIfcFile(bytes);
  }, 30_000);

  test("schema is IFC4", () => {
    expect(doc.schema).toBe("IFC4");
  });

  test("returns exactly 9 spaces, matching the Part 1 inventory count", () => {
    expect(doc.spaces).toHaveLength(9);
  });

  test("units: length is MILLI+METRE, area/volume are bare SQUARE_METRE/CUBIC_METRE - not normalized to CASA-ARQ's metre convention anywhere in this package", () => {
    expect(doc.units.length).toEqual({ name: "METRE", prefix: "MILLI" });
    expect(doc.units.area).toEqual({ name: "SQUARE_METRE", prefix: null });
    expect(doc.units.volume).toEqual({ name: "CUBIC_METRE", prefix: null });
  });

  test("this file DOES declare IfcRelSpaceBoundary", () => {
    expect(doc.hasDeclaredSpaceBoundaries).toBe(true);
  });

  test('the "Sla Reuniones" typo (missing the "a") is preserved verbatim, right next to the correctly-spelled "Sala Reuniones" - neither is corrected', () => {
    const withTypo = doc.spaces.find((s) => s.globalId === "2EIerdp1J5GQsmzj0$nfdG");
    const correct = doc.spaces.find((s) => s.globalId === "11Bx1gJfrQGuXjPuACbo$7");
    expect(withTypo?.longName).toBe("Sla Reuniones");
    expect(correct?.longName).toBe("Sala Reuniones");
  });

  test("LongName carries the human room name, Name carries a number/code - verified per the Part 1 inventory, not assumed", () => {
    const bano = doc.spaces.find((s) => s.globalId === "1GHI8kUcc1GvuISnKo8F23");
    expect(bano?.name).toBe("01");
    expect(bano?.longName).toBe("Baño");

    const comun = doc.spaces.find((s) => s.globalId === "2uWnqb9DWxI93kDO_8r9nz");
    expect(comun?.name).toBe("Común");
    expect(comun?.longName).toBe("Circulaciones");
  });

  test("Qto_SpaceBaseQuantities.Height is 3200 raw (millimetres, per this file's declared unit) - not converted to 3.2 or to metres anywhere", () => {
    const box02 = doc.spaces.find((s) => s.globalId === "3QNzgOX$_wJfS4LQedEtce")!;
    const qto = box02.quantitySets["Qto_SpaceBaseQuantities"];
    expect(qto).toBeDefined();
    expect(qto.Height.value).toBe("3200");
    expect(qto.Height.ifcType).toBe("IFCQUANTITYLENGTH");
    expect(qto.Height.unit).toEqual({ name: "METRE", prefix: "MILLI" });

    expect(qto.GrossFloorArea.value).toBe("9.000000000000004");
    expect(qto.GrossFloorArea.unit).toEqual({ name: "SQUARE_METRE", prefix: null });

    expect(qto.GrossVolume.value).toBe("28.80000000000001");
    expect(qto.GrossVolume.unit).toEqual({ name: "CUBIC_METRE", prefix: null });
  });

  test("standard property sets are present under their real buildingSMART names", () => {
    const box02 = doc.spaces.find((s) => s.globalId === "3QNzgOX$_wJfS4LQedEtce")!;
    expect(Object.keys(box02.propertySets)).toContain("Pset_SpaceCommon");
  });

  test("of the 73 IfcRelSpaceBoundary counted in the Part 1 inventory, 36 have a real RelatedBuildingElement (physical) and are returned; the other 37 are virtual (space-to-space separations with no element) and are correctly excluded - verified by direct recount, not assumed from Part 1's per-relation-type total", () => {
    const total = doc.spaces.reduce((sum, s) => sum + s.boundingElements.length, 0);
    expect(total).toBe(36);
    for (const space of doc.spaces) {
      for (const ref of space.boundingElements) {
        expect(ref.method).toBe("authoritative");
        expect(ref.confidence).toBeUndefined();
      }
    }
  });

  test("first space has 3 physical boundaries (verified by direct recount against the raw file, not Part 1's unfiltered per-space total of 6, which included virtual boundaries)", () => {
    const space = doc.spaces.find((s) => s.globalId === "3QNzgOX$_wJfS4LQedEtce")!;
    expect(space.boundingElements).toHaveLength(3);
  });
});
