import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseBcf } from "../reader";
import { writeBcf } from "../writer";
import type { BcfProject, BcfTopic } from "../types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(__dirname, "fixtures", name)));
}

// Prueba crítica (ver prompt de extracción): leer un .bcfzip real, escribirlo
// de vuelta, leerlo de nuevo, y confirmar que el modelo es idéntico.
describe("round-trip: parseBcf -> writeBcf -> parseBcf", () => {
  test("BCF 2.1 real (bcf-pdf-exporter/test-fixtures/sample.bcf) sobrevive el round-trip completo", async () => {
    const original = await parseBcf(loadFixture("sample-2.1.bcf"));
    const rewritten = await writeBcf(original);
    const reread = await parseBcf(rewritten);

    expect(reread).toEqual(original);
  });

  test("BCF 3.0 sintético (múltiples viewpoints, DueDate) sobrevive el round-trip completo", async () => {
    const original = await parseBcf(loadFixture("sample-3.0.bcf"));
    const rewritten = await writeBcf(original);
    const reread = await parseBcf(rewritten);

    expect(reread).toEqual(original);
  });

  test("la cámara mantiene precisión decimal completa a través del round-trip", async () => {
    const original = await parseBcf(loadFixture("sample-2.1.bcf"));
    const rewritten = await writeBcf(original);
    const reread = await parseBcf(rewritten);

    expect(reread.topics[0].viewpoints[0].camera).toEqual(original.topics[0].viewpoints[0].camera);
  });

  test("los bytes del snapshot son idénticos, byte a byte, después del round-trip", async () => {
    const original = await parseBcf(loadFixture("sample-2.1.bcf"));
    const rewritten = await writeBcf(original);
    const reread = await parseBcf(rewritten);

    const originalBytes = original.topics[0].viewpoints[0].snapshot;
    const rereadBytes = reread.topics[0].viewpoints[0].snapshot;
    expect(rereadBytes).toEqual(originalBytes);
  });
});

function minimalTopic(overrides: Partial<BcfTopic> = {}): BcfTopic {
  return {
    guid: "t-minimal",
    title: "Topic mínimo",
    labels: [],
    creationDate: "2026-01-01T00:00:00Z",
    creationAuthor: "test@bwisebim.com",
    referenceLinks: [],
    relatedTopics: [],
    comments: [],
    viewpoints: [],
    ...overrides,
  };
}

describe("writeBcf - casos límite (no deben crashear)", () => {
  test("un topic sin comentarios, sin viewpoints y sin snapshot se escribe y se vuelve a leer sin error", async () => {
    const project: BcfProject = { version: "2.1", topics: [minimalTopic()] };
    const bytes = await writeBcf(project);
    const reread = await parseBcf(bytes);

    expect(reread.topics).toHaveLength(1);
    expect(reread.topics[0].comments).toEqual([]);
    expect(reread.topics[0].viewpoints).toEqual([]);
  });

  test("un viewpoint con cámara pero sin snapshot ni componentes se escribe y se vuelve a leer sin error", async () => {
    const project: BcfProject = {
      version: "2.1",
      topics: [
        minimalTopic({
          viewpoints: [
            {
              guid: "vp-1",
              camera: {
                type: "Orthogonal",
                viewPoint: { x: 1, y: 2, z: 3 },
                direction: { x: 0, y: 0, z: -1 },
                upVector: { x: 0, y: 1, z: 0 },
                viewToWorldScale: 42.5,
              },
              clippingPlanes: [],
              components: { selection: [], coloring: [] },
            },
          ],
        }),
      ],
    };

    const bytes = await writeBcf(project);
    const reread = await parseBcf(bytes);
    expect(reread.topics[0].viewpoints[0].camera?.type).toBe("Orthogonal");
    expect(reread.topics[0].viewpoints[0].camera?.viewToWorldScale).toBe(42.5);
    expect(reread.topics[0].viewpoints[0].snapshot).toBeUndefined();
  });

  test("un proyecto sin topics se escribe y se vuelve a leer como error (BCF requiere al menos un markup.bcf)", async () => {
    const project: BcfProject = { version: "2.1", topics: [] };
    const bytes = await writeBcf(project);
    // writeBcf no fuerza que haya topics (el caller puede querer solo bcf.version
    // en un intermedio), pero parseBcf sí exige al menos un markup.bcf real -
    // documentado en reader.spec.ts. Confirma que ambos lados son consistentes
    // con esa regla, no que uno "arregla" al otro en silencio.
    await expect(parseBcf(bytes)).rejects.toThrow(/no parece ser un archivo BCF válido/i);
  });
});
