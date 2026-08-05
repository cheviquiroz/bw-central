import { describe, test, expect } from "vitest";
import type { IfcHeadlessDocument, IfcSpaceRecord } from "@bw-central/ifc-headless";
import { calculateOccupancyLoad } from "../engine/calculateOccupancyLoad";
import { evaluateStairs } from "../engine/evaluateStairs";
import { evaluateEvacuationRoutes } from "../engine/evaluateEvacuationRoutes";

function makeSpace(overrides: Partial<IfcSpaceRecord>): IfcSpaceRecord {
  return {
    expressId: 1,
    globalId: "TEST_GLOBAL_ID",
    name: null,
    longName: null,
    description: null,
    objectType: null,
    storeyExpressId: null,
    propertySets: {},
    quantitySets: {},
    boundingElements: [],
    adjacentSpaces: [],
    ...overrides,
  };
}

function makeDoc(spaces: IfcSpaceRecord[]): IfcHeadlessDocument {
  return {
    schema: "IFC4",
    units: { length: { name: "METRE", prefix: null }, area: { name: "SQUARE_METRE", prefix: null }, volume: { name: "CUBIC_METRE", prefix: null } },
    hasDeclaredSpaceBoundaries: false,
    spaces,
  };
}

describe("occupancy load: a space whose area quantity is declared in a non-bare-m2 unit is never silently treated as m2", () => {
  test("an area quantity declared as MILLI+SQUARE_METRE (hypothetical - none of the 4 real fixtures do this) is refused, not divided as if it were m2", () => {
    const space = makeSpace({
      globalId: "MM2_SPACE",
      longName: "Oficinas",
      quantitySets: {
        Qto_SpaceBaseQuantities: {
          GrossFloorArea: { value: "9000000", ifcType: "IFCQUANTITYAREA", unit: { name: "SQUARE_METRE", prefix: "MILLI" } },
        },
      },
    });
    const result = calculateOccupancyLoad(makeDoc([space]));
    const s = result.spaces[0];
    expect(s.status).toBe("unit-not-resolvable");
    expect(s.areaM2).toBeNull();
    expect(s.ocupantes).toBeNull();
    expect(s.notes.some((n) => n.includes("never converts units"))).toBe(true);
    // No debe aparecer en el total ni en el área clasificada.
    expect(result.totalOcupantes).toBe(0);
    expect(result.classifiedAreaM2).toBe(0);
  });

  test("a space with no NetFloorArea/GrossFloorArea quantity at all is reported as no-area, not silently skipped or defaulted to zero occupants", () => {
    const space = makeSpace({ globalId: "NO_AREA_SPACE", longName: "Oficinas" });
    const result = calculateOccupancyLoad(makeDoc([space]));
    const s = result.spaces[0];
    expect(s.status).toBe("no-area");
    expect(s.ocupantes).toBeNull();
    expect(result.unclassified).toHaveLength(1);
  });
});

describe("occupancy load: manual overrides (Art. 4.2.4 asientos fijos / aposentadurías corridas, Art. 4.2.9 external areas)", () => {
  test("a manual override supplies ocupantes directly and skips destino matching entirely", () => {
    const space = makeSpace({ globalId: "AUDITORIO", longName: "Auditorio con asientos fijos" });
    const result = calculateOccupancyLoad(makeDoc([space]), {
      manualOverrides: { AUDITORIO: { ocupantes: 340, reason: "Conteo real de asientos fijos", articulo: "4.2.4" } },
    });
    const s = result.spaces[0];
    expect(s.status).toBe("manual-override");
    expect(s.ocupantes).toBe(340);
    expect(result.totalOcupantes).toBe(340);
  });
});

describe("evaluateStairs: a building whose total occupancy exceeds 1.000 flags the Estudio de Evacuación requirement, never an extrapolated table row", () => {
  test("total occupancy of 1200 triggers requires-study, not a fabricated stairs row", () => {
    const evaluation = evaluateStairs(1200);
    expect(evaluation.requirement.status).toBe("requires-study");
    expect(evaluation.modeledStairsAvailable).toBe(false);
  });

  test("total occupancy of 1000 (exactly at the table's ceiling) still resolves to the last table row", () => {
    const evaluation = evaluateStairs(1000);
    expect(evaluation.requirement.status).toBe("table");
  });
});

describe("evaluateEvacuationRoutes: rules that need data ifc-headless does not expose come back not-evaluable, never a fabricated pass/fail", () => {
  test("perSpace height/width rules are not-evaluable when no Height/Width quantity exists", () => {
    const space = makeSpace({ globalId: "NO_DIMS" });
    const evaluation = evaluateEvacuationRoutes(makeDoc([space]), 0);
    const heightRule = evaluation.perSpace[0].rules.find((r) => r.rule === "altura_libre_minima_via_evacuacion")!;
    const widthRule = evaluation.perSpace[0].rules.find((r) => r.rule === "ancho_minimo_via_evacuacion")!;
    expect(heightRule.status).toBe("not-evaluable");
    expect(widthRule.status).toBe("not-evaluable");
  });

  test("distance/sprinkler/stair-construction rules (4.2.11-4.2.14, door height in 4.2.6) are always listed as not-evaluable, named individually", () => {
    const evaluation = evaluateEvacuationRoutes(makeDoc([]), 0);
    const articles = evaluation.notEvaluable.map((r) => r.articulo);
    expect(articles).toEqual(expect.arrayContaining(["4.2.6", "4.2.11", "4.2.12", "4.2.13", "4.2.14"]));
    expect(evaluation.notEvaluable.every((r) => r.status === "not-evaluable")).toBe(true);
  });
});
