import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile, type IfcHeadlessDocument, type IfcRamp, type IfcElevator } from "@bw-central/ifc-headless";
import { calculateOccupancyLoad } from "../engine/calculateOccupancyLoad";
import { evaluateStairCompliance } from "../engine/evaluateStairCompliance";
import { determineStairRequirement } from "../engine/stairRequirement";
import { isAccessibleRamp, isAccessibleElevator } from "../engine/accessibleAlternatives";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../../fixtures");

function makeRamp(overrides: Partial<IfcRamp>): IfcRamp {
  return { expressId: 1, globalId: "RAMP", name: null, objectType: null, slope: null, slopePercentage: null, storeyExpressId: null, isAccessible: "unknown", boundingBox: null, ...overrides };
}
function makeElevator(overrides: Partial<IfcElevator>): IfcElevator {
  return { expressId: 1, globalId: "ELEV", name: null, objectType: null, isAccessible: "unknown", boundingBox: null, servedStoreyExpressIds: null, carryingCapacity: null, ...overrides };
}

describe("Art. 4.2.10 full compliance evaluation on CASA-ARQ.ifc (real fixture)", () => {
  let doc: IfcHeadlessDocument;
  let occupancyLoad: number;
  // 8 real IfcBuildingStorey entities, verified by direct
  // GetLineIDsWithType(IFCBUILDINGSTOREY) count against the raw file
  // (TERRENO, Fondazione, Piano SEMINTERRATO, Piano TERRA, Piano PRIMO,
  // Piano SECONDO, Piano TERZO, Copertura) - ifc-headless does not
  // expose a storey list itself (Fase 1.1's own documented limitation),
  // so this is supplied as an external input, same as the task's own
  // contract expects storeyCount to be.
  const REAL_CASA_ARQ_STOREY_COUNT = 8;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "CASA-ARQ.ifc")));
    doc = await readIfcFile(bytes);
    occupancyLoad = calculateOccupancyLoad(doc).totalOcupantes;
  }, 30_000);

  test("8 real storeys -> stairs ARE required, regardless of ramps/elevators (Art. 4.2.8: neither is an evacuation route)", () => {
    const requirement = determineStairRequirement({ storeyCount: REAL_CASA_ARQ_STOREY_COUNT });
    expect(requirement.stairsRequired).toBe(true);
  });

  test("full evaluation: stairs required, occupancy in 'hasta 50' bracket, 9 real stairs PASS the count requirement", () => {
    const result = evaluateStairCompliance({
      storeyCount: REAL_CASA_ARQ_STOREY_COUNT,
      occupancyLoad,
      confirmedStairCount: doc.stairs.length,
    });

    expect(result.stairsRequired).toBe(true);
    expect(result.verdict).toBe("PASS");
    expect(result.required).toEqual({ stairCount: 1, stairWidth: 1.1 });
    expect(result.detected).toEqual({ stairCount: 9 });
    expect(result.occupancyLoad).toBe(occupancyLoad);
  });

  test("if this same building were single-storey, the verdict would be NOT_REQUIRED regardless of occupancy or detected stairs - Art. 4.2.10 never even reaches the table lookup", () => {
    const result = evaluateStairCompliance({
      storeyCount: 1,
      occupancyLoad,
      confirmedStairCount: 0,
    });
    expect(result.verdict).toBe("NOT_REQUIRED");
    expect(result.stairsRequired).toBe(false);
    expect(result.reasonNotRequired).toBeDefined();
    expect(result.required).toBeUndefined();
  });
});

describe("Art. 4.2.10 full compliance evaluation on OLAS-ARQ-05.ifc (real fixture, 15 real storeys, zero IfcSpace)", () => {
  let doc: IfcHeadlessDocument;
  // 15 real IfcBuildingStorey entities, verified by direct count against
  // the raw file (1º-13º NIVEL plus FUNDACION and CUBIERTA) - a real,
  // clearly multi-storey building.
  const REAL_OLAS_STOREY_COUNT = 15;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, "OLAS-ARQ-05.ifc")));
    doc = await readIfcFile(bytes);
  }, 30_000);

  test("15 storeys -> stairs ARE structurally required, but occupancy load is 0 (no IfcSpace at all) -> INCOMPLETE_DATA, never a fabricated PASS/FAIL", () => {
    const occupancyLoad = calculateOccupancyLoad(doc).totalOcupantes;
    expect(occupancyLoad).toBe(0);

    const result = evaluateStairCompliance({
      storeyCount: REAL_OLAS_STOREY_COUNT,
      occupancyLoad,
      confirmedStairCount: doc.stairs.length,
    });

    expect(result.stairsRequired).toBe(true);
    expect(result.verdict).toBe("INCOMPLETE_DATA");
  });

  test("with a manually-supplied hypothetical occupancy of 350 (OLAS itself cannot produce a real one): required 2 stairs @ 1.30m, 24 raw stairs PASS", () => {
    const result = evaluateStairCompliance({
      storeyCount: REAL_OLAS_STOREY_COUNT,
      occupancyLoad: 350,
      confirmedStairCount: doc.stairs.length,
    });
    expect(result.stairsRequired).toBe(true);
    expect(result.verdict).toBe("PASS");
    expect(result.required).toEqual({ stairCount: 2, stairWidth: 1.3 });
    expect(result.detected).toEqual({ stairCount: 24 });
  });
});

describe("synthetic: stair requirement depends ONLY on storey count - ramps/elevators (accessible or not) never exempt a building from Art. 4.2.10 (Art. 4.2.8: neither counts as an evacuation route)", () => {
  test("isAccessibleRamp/isAccessibleElevator remain correct on their own terms (see accessibleAlternatives.ts) - they simply aren't consulted by evaluateStairCompliance's input anymore, which no longer even accepts ramps/elevators", () => {
    const accessibleRamp = makeRamp({ isAccessible: true, slopePercentage: 8 });
    const accessibleElevator = makeElevator({ isAccessible: true });
    expect(isAccessibleRamp(accessibleRamp)).toBe(true);
    expect(isAccessibleElevator(accessibleElevator)).toBe(true);
  });

  test("2 storeys, zero detected stairs: stairs are required and FAIL - having ramps/elevators elsewhere in the building would not change this, since evaluateStairCompliance's input has no way to even express them", () => {
    const result = evaluateStairCompliance({ storeyCount: 2, occupancyLoad: 100, confirmedStairCount: 0 });
    expect(result.stairsRequired).toBe(true);
    expect(result.verdict).toBe("FAIL");
  });

  test("2+ storeys, no accessible alternatives at all: stairs required (same outcome as with alternatives - they never change this)", () => {
    const result = evaluateStairCompliance({ storeyCount: 2, occupancyLoad: 30, confirmedStairCount: 1 });
    expect(result.stairsRequired).toBe(true);
  });

  test("occupancy of exactly 50 ('hasta 50' bracket): requires 1 stair @ 1.10m", () => {
    const result = evaluateStairCompliance({ storeyCount: 2, occupancyLoad: 50, confirmedStairCount: 1 });
    expect(result.required).toEqual({ stairCount: 1, stairWidth: 1.1 });
    expect(result.verdict).toBe("PASS");
  });

  test("occupancy of 1001: EXCEEDS_TABLE, never an extrapolated row", () => {
    const result = evaluateStairCompliance({ storeyCount: 2, occupancyLoad: 1001, confirmedStairCount: 2 });
    expect(result.verdict).toBe("EXCEEDS_TABLE");
    expect(result.stairsRequired).toBe(true);
    expect(result.required).toBeUndefined();
  });

  test("single-storey building: NOT_REQUIRED regardless of occupancy or detected stairs", () => {
    const result = evaluateStairCompliance({ storeyCount: 1, occupancyLoad: 500, confirmedStairCount: 0 });
    expect(result.verdict).toBe("NOT_REQUIRED");
  });
});
