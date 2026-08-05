import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile } from "../reader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "../../../oguc-core/fixtures");

// None of this reader's five real fixtures contain a single IfcRamp or
// elevator-typed IfcTransportElement (confirmed by direct
// GetLineIDsWithType probing against the raw files before writing this
// reader - see the commit that adds it). That means these tests can only
// verify the honest-empty-array path against real data; the actual
// slope/accessibility-marker/capacity logic is covered separately by
// synthetic input tests below, since there is no real declared example
// of any of it anywhere in this reader's fixture set.
describe("ifc-headless: ramps and elevators are empty (not undefined, not an error) on all five real fixtures - none of them contain a single IfcRamp or elevator-typed IfcTransportElement", () => {
  const fixtures = ["CASA-ARQ.ifc", "CASA-MEP.ifc", "EOFF-ARQ-IFC-I01.ifc", "EOFF-SPC-IFC-I01.ifc", "OLAS-ARQ-05.ifc"];

  for (const fixture of fixtures) {
    test(`${fixture}: ramps and elevators are both []`, async () => {
      const bytes = new Uint8Array(readFileSync(path.join(FIXTURES, fixture)));
      const doc = await readIfcFile(bytes);
      expect(doc.ramps).toEqual([]);
      expect(doc.elevators).toEqual([]);
    }, 30_000);
  }
});
