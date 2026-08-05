import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile, type IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { calculateOccupancyLoad, type BuildingOccupancyResult } from "../engine/calculateOccupancyLoad";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../../fixtures/EOFF-SPC-IFC-I01.ifc");

describe("oguc-core: occupancy load on EOFF-SPC-IFC-I01.ifc (real fixture, Spanish room names, MILLI+METRE length unit)", () => {
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

  test("\"Sala Reuniones\" matches otros.salonesReuniones (0.8 m2/persona) at low confidence - only the distinctive token 'reuniones' overlaps, 'sala' vs 'salones' does not", () => {
    const s = find("11Bx1gJfrQGuXjPuACbo$7");
    expect(s.destinoMatch.destino).toBe("otros.salonesReuniones");
    expect(s.destinoMatch.confidence).toBe("low");
    expect(s.destinoMatch.m2PorPersona).toBe(0.8);
    expect(s.status).toBe("calculated");
    // GrossFloorArea is declared as a bare SQUARE_METRE regardless of this file's MILLI+METRE length unit - honored as-is, not converted.
    expect(s.areaM2).toBe(12);
    expect(s.ocupantes).toBe(15);
  });

  test("the \"Sla Reuniones\" typo matches identically to the correctly-spelled version - the matcher works on the shared distinctive token, not exact spelling, so the typo is not silently corrected, just happens to still match", () => {
    const s = find("2EIerdp1J5GQsmzj0$nfdG");
    expect(s.destinoMatch.destino).toBe("otros.salonesReuniones");
    expect(s.destinoMatch.confidence).toBe("low");
    expect(s.status).toBe("calculated");
  });

  test("\"Baño\" comes back unmatched - Art. 4.2.4 has no bathroom category, consistent with CASA-ARQ's \"bagno\" spaces", () => {
    const s = find("1GHI8kUcc1GvuISnKo8F23");
    expect(s.destinoMatch.confidence).toBe("unmatched");
    expect(s.status).toBe("unmatched");
    expect(s.ocupantes).toBeNull();
  });

  test("\"Común\"/\"Circulaciones\" comes back unmatched, NOT matched to \"Estacionamientos de uso común\" via the qualifier word \"común\" - that would be a false category match on a grammatical qualifier, not the actual destino noun", () => {
    const s = occ.spaces.find((s) => s.spaceName === "Común");
    expect(s, "space named \"Común\" not found").toBeDefined();
    expect(s!.destinoMatch.confidence).toBe("unmatched");
  });

  test("this file's Height quantity is declared in millimetres (3200) - occupancy area calculation never touches Height, and area itself is honored as the bare-SQUARE_METRE Net/GrossFloorArea already in the file, not derived from Height x anything", () => {
    const s = find("11Bx1gJfrQGuXjPuACbo$7");
    expect(s.areaSourceQuantity).toMatch(/(Net|Gross)FloorArea$/);
  });

  test("total occupancy sums only the two matched Salones de reuniones spaces (15 + 15 = 30); Box/Baño/Común spaces are excluded", () => {
    expect(occ.totalOcupantes).toBe(30);
  });
});
