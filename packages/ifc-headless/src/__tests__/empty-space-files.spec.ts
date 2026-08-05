import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { readIfcFile } from "../reader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CASA-MEP y EOFF-ARQ son la mitad "sin espacios" de cada par federado
// (CASA-ARQ/CASA-MEP, EOFF-ARQ/EOFF-SPC - ver Parte 1). Se procesan acá
// como archivos completamente independientes, nunca fusionados con su
// contraparte: este paquete no tiene ninguna API multi-archivo.

describe("ifc-headless: files with zero IfcSpace (by design, not by error)", () => {
  test("CASA-MEP.ifc (IFC2X3, ~394MB, pure MEP - zero architecture/space entities) returns a valid empty result", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(__dirname, "../../../oguc-core/fixtures/CASA-MEP.ifc")));
    const doc = await readIfcFile(bytes);
    expect(doc.schema).toBe("IFC2X3");
    expect(doc.spaces).toEqual([]);
  }, 30_000);

  test("EOFF-ARQ-IFC-I01.ifc (IFC4, architecture only - spaces live in EOFF-SPC instead) returns a valid empty result", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(__dirname, "../../../oguc-core/fixtures/EOFF-ARQ-IFC-I01.ifc")));
    const doc = await readIfcFile(bytes);
    expect(doc.schema).toBe("IFC4");
    expect(doc.spaces).toEqual([]);
  });
});
