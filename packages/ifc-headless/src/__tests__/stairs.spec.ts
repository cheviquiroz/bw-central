import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile } from "../reader";
import type { IfcHeadlessDocument } from "../types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../../../oguc-core/fixtures");

describe("ifc-headless: stairs on OLAS-ARQ-05.ifc (real fixture, ArchiCAD export, 24 IfcStair)", () => {
  let doc: IfcHeadlessDocument;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "OLAS-ARQ-05.ifc")));
    doc = await readIfcFile(bytes);
  }, 30_000);

  test("finds exactly 24 stairs, matching the file's real IfcStair count", () => {
    expect(doc.stairs).toHaveLength(24);
  });

  test('all 24 share the literal Name "ESCALERA - 001" (verified against the raw file, not assumed distinct)', () => {
    for (const stair of doc.stairs) {
      expect(stair.name).toBe("ESCALERA - 001");
      expect(stair.objectType).toBeNull();
    }
  });

  test(
    "every stair has ZERO flights - this file has no IfcStairFlight entities at all (confirmed by direct GetLineIDsWithType count against the raw file): each IfcStair decomposes via IfcRelAggregates into generic IfcBuildingElementProxy children instead, which this reader does not reinterpret as flights or use to guess riser/tread",
    () => {
      for (const stair of doc.stairs) {
        expect(stair.flights).toEqual([]);
      }
    }
  );

  test("isSecurityZone is 'unknown' for every stair - this file has no property set naming a zona vertical de seguridad marker anywhere", () => {
    for (const stair of doc.stairs) {
      expect(stair.isSecurityZone).toBe("unknown");
    }
  });

  test("boundingBox is real geometry (union of the stair's decomposed IfcBuildingElementProxy children, since the IfcStair entity itself has no direct Representation in this file) - never null, never a fabricated box", () => {
    for (const stair of doc.stairs) {
      expect(stair.boundingBox).not.toBeNull();
      const box = stair.boundingBox!;
      // Cada eje del máximo debe ser estrictamente mayor que el mínimo -
      // una caja real, no un placeholder degenerado.
      for (let axis = 0; axis < 3; axis++) {
        expect(box.max[axis]).toBeGreaterThan(box.min[axis]);
      }
    }
  });

  test("storey containment resolves correctly against the real building structure for 3 specific stairs, verified by direct storey-name lookup against the raw file", () => {
    const byGlobalId = new Map(doc.stairs.map((s) => [s.globalId, s]));

    // expressId 28204 = "1º NIVEL", 28238 = "2º NIVEL tipo (2º al 4º)", 29744 = "4º NIVEL" - verified directly against the raw file, not assumed.
    const first = byGlobalId.get("3L1PzmFOwmJAArI84Jy9Hm")!;
    expect(first.storeyExpressId).toBe(28238);

    const second = byGlobalId.get("1fjnagicngHO8aSEtdPqGg")!;
    expect(second.storeyExpressId).toBe(28204);

    const fifth = byGlobalId.get("3eppm81vKeopF7WWBzCl5l")!;
    expect(fifth.storeyExpressId).toBe(29744);
  });

  test("every stair resolves SOME storey (not null) in this file - a weaker, file-wide sanity check alongside the 3 specific assertions above", () => {
    const withStorey = doc.stairs.filter((s) => s.storeyExpressId !== null);
    expect(withStorey.length).toBe(24);
  });
});

describe("ifc-headless: stairs on CASA-ARQ.ifc (real fixture - HAS real IfcStairFlight entities, unlike OLAS)", () => {
  let doc: IfcHeadlessDocument;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "CASA-ARQ.ifc")));
    doc = await readIfcFile(bytes);
  }, 30_000);

  test("finds 9 stairs with 19 total flights across them (direct recount against the raw file) - Fase 1.2 reported 'zero stairs' only because ifc-headless didn't look for them yet, not because CASA-ARQ has none", () => {
    expect(doc.stairs).toHaveLength(9);
    const totalFlights = doc.stairs.reduce((sum, s) => sum + s.flights.length, 0);
    expect(totalFlights).toBe(19);
  });

  test("distinguishes a 1-flight stair from a 3-flight stair correctly", () => {
    const oneFlightStair = doc.stairs.find((s) => s.globalId === "3A9mHNCgLBDeuBGTYTkQcs")!; // "Scala 204763"
    expect(oneFlightStair.flights).toHaveLength(1);

    const threeFlightStair = doc.stairs.find((s) => s.globalId === "0Se68GiPfF9vsQyLjFzV3H")!; // "Scala 118244"
    expect(threeFlightStair.flights).toHaveLength(3);
  });

  test("this file's real IfcStairFlight entities all leave NumberOfRiser/TreadLength/RiserHeight undeclared (null) - not fabricated as 0 or derived from geometry", () => {
    for (const stair of doc.stairs) {
      for (const flight of stair.flights) {
        expect(flight.riserCount).toBeNull();
        expect(flight.treadDepth).toBeNull();
        expect(flight.riserHeight).toBeNull();
        // El unit context sí está presente, aunque los valores no lo estén.
        expect(flight.lengthUnit).toEqual({ name: "METRE", prefix: null });
      }
    }
  });

  test("a stair contained directly at IfcSite level (not inside any IfcBuildingStorey) correctly resolves storeyExpressId to null, not the site's ID", () => {
    // Verificado contra el archivo: esta es la única de las 9 escaleras
    // contenida directamente en el IfcSite, sin IfcBuildingStorey.
    const siteLevelStair = doc.stairs.find((s) => s.globalId === "3A9mHNCgLBDeuBGTYTkQcs")!;
    expect(siteLevelStair.storeyExpressId).toBeNull();
  });

  test("a stair contained in a real IfcBuildingStorey resolves it correctly", () => {
    const stair = doc.stairs.find((s) => s.globalId === "0Se68GiPfF9vsQyLjFzV3H")!;
    expect(stair.storeyExpressId).not.toBeNull();
  });
});

describe("ifc-headless: stairs are empty (not undefined, not an error) on files with no real IfcStair", () => {
  test("EOFF-ARQ-IFC-I01.ifc has zero stairs", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "EOFF-ARQ-IFC-I01.ifc")));
    const doc = await readIfcFile(bytes);
    expect(doc.stairs).toEqual([]);
  }, 30_000);

  test("EOFF-SPC-IFC-I01.ifc has zero stairs", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "EOFF-SPC-IFC-I01.ifc")));
    const doc = await readIfcFile(bytes);
    expect(doc.stairs).toEqual([]);
  }, 30_000);
});
