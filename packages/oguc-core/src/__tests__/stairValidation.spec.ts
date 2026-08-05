import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile, type IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { calculateOccupancyLoad } from "../engine/calculateOccupancyLoad";
import { validateStairs } from "../engine/stairValidation";
import { lookupStairsRequirement } from "../dictionary/stairs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../../fixtures");

describe("Art. 4.2.10 stair validation against CASA-ARQ.ifc (real fixture, real IfcStairFlight entities, high confidence)", () => {
  let doc: IfcHeadlessDocument;
  let occupancyLoad: number;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "CASA-ARQ.ifc")));
    doc = await readIfcFile(bytes);
    occupancyLoad = calculateOccupancyLoad(doc).totalOcupantes;
  }, 30_000);

  test("real occupancy load computed by Fase 1.2 Part A falls in the 'hasta 50' bracket", () => {
    // No se asume ~73 personas (una cifra ilustrativa de este prompt) -
    // se usa el número real que calculateOccupancyLoad produce hoy sobre
    // este fixture (ver el resumen de la tarea de Fase 1.2 Parte A: ~35.4,
    // porque solo garage/ufficio/2x cucina-pranzo calzan con un destino
    // de la tabla 4.2.4 - la mayoría de los recintos de una casa no
    // tienen entrada aplicable). Cualquiera sea el valor exacto, sigue
    // cayendo en el mismo tramo "hasta 50" que la cifra ilustrativa del
    // prompt, así que el resultado exigido por la tabla no cambia.
    expect(occupancyLoad).toBeGreaterThan(0);
    expect(occupancyLoad).toBeLessThan(50);
    const lookup = lookupStairsRequirement(occupancyLoad);
    expect(lookup.status).toBe("table");
    if (lookup.status === "table") {
      expect(lookup.row.minCount).toBe(1);
      expect(lookup.row.minWidthM).toBe(1.1);
    }
  });

  test("validateStairs: 9 detected stairs (real, high confidence) PASS the count requirement (9 >= 1)", () => {
    const result = validateStairs({
      occupancyLoad,
      confirmedStairCount: doc.stairs.length,
      detectedStairs: doc.stairs,
      confidence: "high",
    });

    expect(doc.stairs).toHaveLength(9);
    expect(result.required.stairCount).toBe(1);
    expect(result.required.stairWidthM).toBe(1.1);
    expect(result.detected.stairCount).toBe(9);
    expect(result.detected.confidence).toBe("high");
    expect(result.verdict).toBe("PASS");
    expect(result.details?.stairCountMatch).toBe(true);
  });

  test("width is NOT checkable even at high confidence - Art. 4.2.10's 'ancho' (clear width) is not the same measurement as IfcStairFlight's riser/tread, and neither IFC schema nor ifc-headless exposes a real width for a flight", () => {
    const result = validateStairs({
      occupancyLoad,
      confirmedStairCount: doc.stairs.length,
      detectedStairs: doc.stairs,
      confidence: "high",
    });
    expect(result.details?.widthCheckable).toBe(false);
    expect(result.message).toMatch(/cannot verify stair width/);
  });

  test("3 real stairs' declared riser/tread are checked directly: all null (undeclared) in this file - confirms width truly isn't derivable from these fixtures' own data, not just unimplemented", () => {
    const checked = doc.stairs.slice(0, 3);
    for (const stair of checked) {
      for (const flight of stair.flights) {
        expect(flight.riserHeight).toBeNull();
        expect(flight.treadDepth).toBeNull();
      }
    }
  });

  test("zero detected stairs FAILs the count requirement even though the real file has 9 - the validator trusts its confirmedStairCount input, not doc.stairs directly, since that input is meant to come from a human-confirmed Pre-Check count", () => {
    const result = validateStairs({
      occupancyLoad,
      confirmedStairCount: 0,
      detectedStairs: [],
      confidence: "manual",
    });
    expect(result.verdict).toBe("FAIL");
    expect(result.details?.stairCountMatch).toBe(false);
  });
});

describe("Art. 4.2.10 stair validation against OLAS-ARQ-05.ifc (real fixture, 24 raw IfcStair fragments, no IfcSpace)", () => {
  let doc: IfcHeadlessDocument;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "OLAS-ARQ-05.ifc")));
    doc = await readIfcFile(bytes);
  }, 30_000);

  test("OLAS has zero IfcSpace, so its real occupancy load is 0 - Art. 4.2.10 correctly refuses to validate without a real occupancy number (INCOMPLETE_DATA), rather than silently validating against a fabricated one", () => {
    const occupancyLoad = calculateOccupancyLoad(doc).totalOcupantes;
    expect(occupancyLoad).toBe(0);

    const result = validateStairs({
      occupancyLoad,
      confirmedStairCount: doc.stairs.length,
      detectedStairs: doc.stairs,
      confidence: "low",
    });
    expect(result.verdict).toBe("INCOMPLETE_DATA");
  });

  test(
    "with a manually-supplied hypothetical occupancy of 350 persons (this package cannot derive one from OLAS itself): required is 2 stairs @ 1.30m. No stair-grouping heuristic exists in this codebase (out of scope per this task's own constraints) so this uses OLAS's raw, ungrouped 24 IfcStair count directly, at 'low' confidence - not the prompt's illustrative '~12 logical stairs', which would need a real grouping algorithm this task does not build",
    () => {
      const result = validateStairs({
        occupancyLoad: 350,
        confirmedStairCount: doc.stairs.length,
        detectedStairs: doc.stairs,
        confidence: "low",
      });

      expect(doc.stairs).toHaveLength(24);
      expect(result.required.stairCount).toBe(2);
      expect(result.required.stairWidthM).toBe(1.3);
      expect(result.detected.stairCount).toBe(24);
      expect(result.detected.confidence).toBe("low");
      expect(result.verdict).toBe("PASS"); // 24 >= 2
      expect(result.details?.widthCheckable).toBe(false);
      expect(result.message).toMatch(/low confidence/);
    }
  );

  test("this file's stairs have zero IfcStairFlight entities at all (confirmed in Fase 1.1 Part B) - width is not checkable here for an even more basic reason than CASA-ARQ's undeclared-but-present flights", () => {
    for (const stair of doc.stairs) {
      expect(stair.flights).toEqual([]);
    }
  });
});

describe("Art. 4.2.10 boundary conditions (table lookups break at edges, if anywhere)", () => {
  const detectedStairs: never[] = [];

  test("exactly 50 persons: 'hasta 50' bracket, 1 stair @ 1.10m", () => {
    const result = validateStairs({ occupancyLoad: 50, confirmedStairCount: 1, detectedStairs, confidence: "manual" });
    expect(result.occupancyRange).toBe("1-50");
    expect(result.required).toEqual({ stairCount: 1, stairWidthM: 1.1 });
    expect(result.verdict).toBe("PASS");
  });

  test("exactly 51 persons: crosses into the next bracket, 1 stair @ 1.20m", () => {
    const result = validateStairs({ occupancyLoad: 51, confirmedStairCount: 1, detectedStairs, confidence: "manual" });
    expect(result.occupancyRange).toBe("51-100");
    expect(result.required).toEqual({ stairCount: 1, stairWidthM: 1.2 });
  });

  test("exactly 100 vs 101: still 1 required stair on both sides of this boundary (the count only changes at 250/251)", () => {
    const at100 = validateStairs({ occupancyLoad: 100, confirmedStairCount: 1, detectedStairs, confidence: "manual" });
    const at101 = validateStairs({ occupancyLoad: 101, confirmedStairCount: 1, detectedStairs, confidence: "manual" });
    expect(at100.required.stairCount).toBe(1);
    expect(at101.required.stairCount).toBe(1);
    expect(at100.required.stairWidthM).toBe(1.2);
    expect(at101.required.stairWidthM).toBe(1.3);
  });

  test("exactly 1.000 persons: still the last table row (2 stairs @ 1.60m), NOT EXCEEDS_TABLE", () => {
    const result = validateStairs({ occupancyLoad: 1000, confirmedStairCount: 2, detectedStairs, confidence: "manual" });
    expect(result.occupancyRange).toBe("701-1000");
    expect(result.required).toEqual({ stairCount: 2, stairWidthM: 1.6 });
    expect(result.verdict).toBe("PASS");
  });

  test("exactly 1.001 persons: EXCEEDS_TABLE, requires Estudio de Evacuación - never an extrapolated row", () => {
    const result = validateStairs({ occupancyLoad: 1001, confirmedStairCount: 2, detectedStairs, confidence: "manual" });
    expect(result.verdict).toBe("EXCEEDS_TABLE");
    expect(result.occupancyRange).toBe(">1000");
    expect(result.required).toEqual({ stairCount: null, stairWidthM: null });
    expect(result.message).toMatch(/Estudio de Evacuación/);
  });

  test("occupancy of 0 (a model with zero spaces): INCOMPLETE_DATA, not a fabricated PASS/FAIL", () => {
    const result = validateStairs({ occupancyLoad: 0, confirmedStairCount: 0, detectedStairs, confidence: "manual" });
    expect(result.verdict).toBe("INCOMPLETE_DATA");
  });

  test("zero detected stairs against a real occupancy load: FAIL, never silently passed", () => {
    const result = validateStairs({ occupancyLoad: 80, confirmedStairCount: 0, detectedStairs, confidence: "manual" });
    expect(result.verdict).toBe("FAIL");
    expect(result.details?.stairCountMatch).toBe(false);
  });
});
