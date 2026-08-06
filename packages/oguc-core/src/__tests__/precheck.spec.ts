import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile, type IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { runPreCheck } from "../precheck";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../../fixtures");

async function loadFixture(name: string): Promise<IfcHeadlessDocument> {
  const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, name)));
  return readIfcFile(bytes);
}

describe("runPreCheck on CASA-ARQ.ifc (real fixture, complete model)", () => {
  let doc: IfcHeadlessDocument;
  beforeAll(async () => {
    doc = await loadFixture("CASA-ARQ.ifc");
  });

  test("no blocking issues - a complete, well-formed model", () => {
    const result = runPreCheck(doc);
    expect(result.blocking).toEqual([]);
  });

  test("info always includes units, export-tool (unavailable), and model summary", () => {
    const result = runPreCheck(doc);
    const ids = result.info.map((i) => i.id);
    expect(ids).toContain("file-units");
    expect(ids).toContain("export-tool");
    expect(ids).toContain("model-summary");
  });
});

describe("runPreCheck on EOFF-SPC-IFC-I01.ifc (real fixture, office spaces)", () => {
  let doc: IfcHeadlessDocument;
  beforeAll(async () => {
    doc = await loadFixture("EOFF-SPC-IFC-I01.ifc");
  });

  test("no blocking issues", () => {
    const result = runPreCheck(doc);
    expect(result.blocking).toEqual([]);
  });

  test("has real spaces to evaluate", () => {
    expect(doc.spaces.length).toBeGreaterThan(0);
  });
});

describe("runPreCheck on OLAS-ARQ-05.ifc (real fixture, zero IfcSpace, 24 raw IfcStair fragments)", () => {
  let doc: IfcHeadlessDocument;
  beforeAll(async () => {
    doc = await loadFixture("OLAS-ARQ-05.ifc");
  });

  test("zero IfcSpace but real stair geometry exists - blocked on zero-spaces, not no-geometry", () => {
    const result = runPreCheck(doc);
    const ids = result.blocking.map((i) => i.id);
    expect(ids).toContain("zero-spaces");
    expect(ids).not.toContain("no-geometry");
  });

  test("fragmented stairs warning fires for this file's documented 24-fragment pattern", () => {
    const result = runPreCheck(doc);
    const fragmented = result.warnings.filter((w) => w.id.startsWith("fragmented-stairs-"));
    expect(fragmented.length).toBeGreaterThan(0);
  });
});

describe("runPreCheck on synthetic zero-area/zero-height data", () => {
  test("a space with a declared area of exactly 0 m² blocks with zero-area", () => {
    const doc: IfcHeadlessDocument = {
      schema: "IFC4",
      units: { length: null, area: null, volume: null },
      hasDeclaredSpaceBoundaries: false,
      stairs: [],
      ramps: [],
      elevators: [],
      spaces: [
        {
          expressId: 1,
          globalId: "SPACE1",
          name: "Oficina",
          longName: null,
          description: null,
          objectType: "OFICINA",
          storeyExpressId: 10,
          propertySets: {},
          quantitySets: {
            Qto_SpaceBaseQuantities: {
              NetFloorArea: { value: "0", ifcType: "IFCQUANTITYAREA", unit: { name: "SQUARE_METRE", prefix: null } },
            },
          },
          boundingElements: [{ expressId: 2, ifcType: "IFCWALL", globalId: "W1", method: "authoritative" }],
          adjacentSpaces: [],
        },
      ],
    };

    const result = runPreCheck(doc);
    const ids = result.blocking.map((i) => i.id);
    expect(ids).toContain("zero-area-1");
    // zero-storeys must NOT fire - this synthetic doc has one real storey reference.
    expect(ids).not.toContain("zero-storeys");
  });

  test("spaces/stairs present but no storey references at all -> zero-storeys blocks", () => {
    const doc: IfcHeadlessDocument = {
      schema: "IFC4",
      units: { length: null, area: null, volume: null },
      hasDeclaredSpaceBoundaries: true,
      stairs: [],
      ramps: [],
      elevators: [],
      spaces: [
        {
          expressId: 1,
          globalId: "SPACE1",
          name: "Oficina",
          longName: null,
          description: null,
          objectType: "OFICINA",
          storeyExpressId: null,
          propertySets: {},
          quantitySets: {},
          boundingElements: [{ expressId: 2, ifcType: "IFCWALL", globalId: "W1", method: "authoritative" }],
          adjacentSpaces: [],
        },
      ],
    };

    const result = runPreCheck(doc);
    expect(result.blocking.map((i) => i.id)).toContain("zero-storeys");
  });

  test("a totally empty document (no geometry anywhere) blocks with no-geometry, not zero-spaces", () => {
    const doc: IfcHeadlessDocument = {
      schema: "IFC4",
      units: { length: null, area: null, volume: null },
      hasDeclaredSpaceBoundaries: false,
      spaces: [],
      stairs: [],
      ramps: [],
      elevators: [],
    };

    const result = runPreCheck(doc);
    const ids = result.blocking.map((i) => i.id);
    expect(ids).toContain("no-geometry");
    expect(ids).not.toContain("zero-spaces");
  });
});
