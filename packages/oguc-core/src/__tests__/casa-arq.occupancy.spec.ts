import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile, type IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { calculateOccupancyLoad, type BuildingOccupancyResult } from "../engine/calculateOccupancyLoad";
import { matchDestino } from "../engine/matchDestino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../../fixtures/CASA-ARQ.ifc");

// CASA-ARQ is a real single-family house (Italian room-naming
// convention). It has NO literal "vivienda"/"garage público"/etc space -
// individual rooms of a house don't correspond 1:1 to Art. 4.2.4's
// per-room categories the way, say, a school's rooms do. That mismatch
// is real and is exactly why most of this file's spaces come back
// unmatched below - not a bug in the matcher, a fact about this
// building's destino vs. what the table enumerates.
describe("oguc-core: occupancy load on CASA-ARQ.ifc (real fixture, Italian room names)", () => {
  let doc: IfcHeadlessDocument;
  let occ: BuildingOccupancyResult;

  beforeAll(async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    doc = await readIfcFile(bytes);
    occ = calculateOccupancyLoad(doc);
  }, 30_000);

  function find(globalId: string) {
    const s = occ.spaces.find((s) => s.spaceGlobalId === globalId);
    expect(s, `space ${globalId} not found`).toBeDefined();
    return s!;
  }

  test("\"garage\" (Vano 130606) matches otros.estacionamientos via the bagno/cucina/garage/ufficio starter synonym, at high confidence", () => {
    const s = find("0BKxxPmq5748M94bALj9f6");
    expect(s.destinoMatch.destino).toBe("otros.estacionamientos");
    expect(s.destinoMatch.confidence).toBe("high");
    expect(s.destinoMatch.m2PorPersona).toBe(16.0);
    expect(s.status).toBe("calculated");
    // Raw area from GrossFloorArea in this file's own declared unit (bare metre) - never converted.
    expect(s.areaM2).toBeCloseTo(397.799594686455, 6);
    expect(s.ocupantes).toBeCloseTo(397.799594686455 / 16.0, 6);
  });

  test("\"ufficio\" (Vano 133518) matches oficinas via the ufficio->oficina synonym, at high confidence", () => {
    const s = find("13aiBFxTP6m90oycFUrfwL");
    expect(s.destinoMatch.destino).toBe("oficinas");
    expect(s.destinoMatch.confidence).toBe("high");
    expect(s.destinoMatch.m2PorPersona).toBe(10.0);
    expect(s.status).toBe("calculated");
  });

  test("\"bagno\" (bathroom) spaces come back unmatched - Art. 4.2.4's table has no bathroom/baño category at all, so this is a correct 'no assimilable entry', not a matcher failure", () => {
    // Vano 130611 / bagno.
    const s = find("13lFWb90rBGvNwZUGUZDrV");
    expect(s.destinoMatch.confidence).toBe("unmatched");
    expect(s.status).toBe("unmatched");
    expect(s.ocupantes).toBeNull();
  });

  test("\"disimpegno\" (hallway/landing) is genuinely ambiguous against the table and correctly comes back unmatched, not guessed as a corridor category", () => {
    // Vano 130613 / disimpegno.
    const s = find("0TnViz5BjEUPDWngIFJieF");
    expect(s.destinoMatch.confidence).toBe("unmatched");
    expect(s.status).toBe("unmatched");
  });

  test("\"salotto\" (living room) has no defensible OGUC table entry and correctly comes back unmatched rather than guessed", () => {
    const salotto = doc.spaces.find((s) => s.longName === "salotto");
    expect(salotto).toBeDefined();
    const m = matchDestino(salotto!);
    expect(m.confidence).toBe("unmatched");
  });

  test("unmatched spaces are excluded from the building total but listed in `unclassified`, not silently dropped", () => {
    expect(occ.unclassified.length).toBeGreaterThan(0);
    expect(occ.unclassified.every((s) => s.status !== "calculated")).toBe(true);
    // Cada espacio no clasificado debe tener al menos una nota explicando por qué.
    for (const s of occ.unclassified) {
      expect(s.notes.length).toBeGreaterThan(0);
    }
  });

  test("building total only sums the matched, area-resolved spaces (garage + ufficio + 2x cucina/pranzo)", () => {
    expect(occ.totalOcupantes).toBeCloseTo(35.38704806575993, 6);
  });
});
