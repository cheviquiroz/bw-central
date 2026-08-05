import { describe, test, expect } from "vitest";
import { readIfcFile } from "../reader";

describe("ifc-headless: runs in plain Node, no DOM", () => {
  test("typeof document is undefined in this test environment", () => {
    expect(typeof document).toBe("undefined");
  });

  test("typeof window is undefined in this test environment", () => {
    expect(typeof window).toBe("undefined");
  });

  test("readIfcFile takes exactly one argument (no multi-file/merge overload exists)", () => {
    expect(readIfcFile.length).toBe(1);
  });
});

describe("ifc-headless: malformed input", () => {
  test("a non-IFC byte array throws a clear error, never a silent empty result", async () => {
    const garbage = new TextEncoder().encode("this is not an IFC file at all");
    await expect(readIfcFile(garbage)).rejects.toThrow(/Could not open IFC file/);
  });

  test("an empty byte array throws a clear error", async () => {
    await expect(readIfcFile(new Uint8Array(0))).rejects.toThrow(/Could not open IFC file/);
  });

  test("a truncated real IFC file (first 500 bytes of a real fixture) throws a clear error", async () => {
    // No usa un fixture completo a propósito - trunca el header STEP real
    // para simular un archivo cortado a mitad de descarga/escritura, un
    // caso real, no solo basura aleatoria.
    const validHeader = new TextEncoder().encode(
      "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_NAME('','',(''),(''),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT("
    );
    await expect(readIfcFile(validHeader)).rejects.toThrow(/Could not open IFC file/);
  });
});
