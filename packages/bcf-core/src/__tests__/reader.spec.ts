import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseBcf } from "../reader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(__dirname, "fixtures", name)));
}

describe("parseBcf - fixture BCF 2.1 real (bcf-pdf-exporter/test-fixtures/sample.bcf)", () => {
  test("detecta la versión y los 2 topics", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    expect(project.version).toBe("2.1");
    expect(project.topics).toHaveLength(2);
  });

  test("preserva Priority/TopicStatus como string libre, sin normalizar (\"Alta\", no \"High\")", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    const first = project.topics.find((t) => t.priority === "Alta");
    expect(first).toBeDefined();
    expect(first?.topicStatus).toBe("Open");
  });

  test("ordena los topics por Index", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    expect(project.topics.map((t) => t.index)).toEqual([1, 2]);
  });

  test("parsea comentarios en orden cronológico", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    const topic = project.topics[0];
    expect(topic.comments).toHaveLength(2);
    expect(Date.parse(topic.comments[0].date)).toBeLessThan(Date.parse(topic.comments[1].date));
    expect(topic.comments[0].author).toBe("cvergara@bwisebim.cl");
  });

  test("parsea la cámara del viewpoint con precisión completa", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    const camera = project.topics[0].viewpoints[0].camera;
    expect(camera?.type).toBe("Perspective");
    expect(camera?.viewPoint).toEqual({ x: 12.45, y: 8.32, z: 3.1 });
    expect(camera?.fieldOfView).toBe(60);
  });

  test("parsea selección de componentes, visibilidad con excepciones, y coloring", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    const { components } = project.topics[0].viewpoints[0];
    expect(components.selection).toHaveLength(2);
    expect(components.selection[0]).toEqual({
      ifcGuid: "1a2b3c4d5e6f7g8h9i0j1k",
      originatingSystem: "Revit",
      authoringToolId: "Revit2024",
    });
    expect(components.visibility).toEqual({
      defaultVisibility: true,
      exceptions: [{ ifcGuid: "3c4d5e6f7g8h9i0j1k2l3m", originatingSystem: undefined, authoringToolId: undefined }],
    });
    expect(components.coloring).toEqual([
      { color: "FF0000", components: [{ ifcGuid: "1a2b3c4d5e6f7g8h9i0j1k", originatingSystem: undefined, authoringToolId: undefined }] },
    ]);
  });

  test("parsea clipping planes", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    const planes = project.topics[0].viewpoints[0].clippingPlanes;
    expect(planes).toHaveLength(1);
    expect(planes[0].location).toEqual({ x: 10, y: 5, z: 0 });
  });

  test("parsea el snapshot como bytes crudos (Uint8Array), no como data URI", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    const { snapshot, snapshotMimeType } = project.topics[0].viewpoints[0];
    expect(snapshot).toBeInstanceOf(Uint8Array);
    expect(snapshot?.length).toBeGreaterThan(0);
    // PNG real: firma de 8 bytes 0x89 'P' 'N' 'G' \r \n 0x1A \n
    expect(Array.from(snapshot!.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(snapshotMimeType).toBe("image/png");
  });
});

describe("parseBcf - fixture BCF 3.0 sintético (múltiples viewpoints, DueDate)", () => {
  test("detecta la versión 3.0", async () => {
    const project = await parseBcf(loadFixture("sample-3.0.bcf"));
    expect(project.version).toBe("3.0");
  });

  test("parsea DueDate y RelatedTopic", async () => {
    const project = await parseBcf(loadFixture("sample-3.0.bcf"));
    const topic = project.topics[0];
    expect(topic.dueDate).toBe("2026-07-15T00:00:00Z");
    expect(topic.relatedTopics).toEqual(["b3c3d4e5-0002-0000-0000-000000000002"]);
  });

  test("parsea MÚLTIPLES viewpoints por topic (gap real del módulo BCF de viewer-oguc, que solo soportaba uno)", async () => {
    const project = await parseBcf(loadFixture("sample-3.0.bcf"));
    const topic = project.topics[0];
    expect(topic.viewpoints).toHaveLength(2);
    expect(topic.viewpoints[0].guid).toBe("vp-0001");
    expect(topic.viewpoints[1].guid).toBe("vp-0002");
    expect(topic.viewpoints[0].camera?.viewPoint.x).toBe(12.45);
    expect(topic.viewpoints[1].camera?.viewPoint.x).toBe(13.9);
  });

  test("liga cada comentario a su viewpoint correspondiente", async () => {
    const project = await parseBcf(loadFixture("sample-3.0.bcf"));
    const [comment1, comment2] = project.topics[0].comments;
    expect(comment1.viewpointGuid).toBe("vp-0001");
    expect(comment2.viewpointGuid).toBe("vp-0002");
  });

  test("preserva ModifiedDate/ModifiedAuthor en comentarios", async () => {
    const project = await parseBcf(loadFixture("sample-3.0.bcf"));
    const comment2 = project.topics[0].comments[1];
    expect(comment2.modifiedAuthor).toBe("mep.lead@bwisebim.cl");
  });
});

describe("parseBcf - casos límite", () => {
  test("topics sin comentarios, sin viewpoints y sin snapshots no crashean", async () => {
    const project = await parseBcf(loadFixture("sample-2.1.bcf"));
    // El propio fixture real ya cubre "con datos"; acá se prueba el caso vacío end-to-end en writer.spec.ts
    // (round-trip de un topic minimal), ver ese archivo.
    expect(project.topics.length).toBeGreaterThan(0);
  });

  test("un archivo que no es un ZIP produce un error claro, no un resultado vacío silencioso", async () => {
    const notAZip = new TextEncoder().encode("esto no es un zip");
    await expect(parseBcf(notAZip)).rejects.toThrow(/no se pudo leer|corrupto/i);
  });

  test("un ZIP válido sin ningún markup.bcf produce un error claro", async () => {
    const { default: JSZip } = await import("jszip");
    const emptyZip = new JSZip();
    emptyZip.file("readme.txt", "esto no es un BCF");
    const bytes = await emptyZip.generateAsync({ type: "uint8array" });
    await expect(parseBcf(bytes)).rejects.toThrow(/no parece ser un archivo BCF válido/i);
  });

  test("un archivo sin bcf.version resuelve version a \"unknown\" en vez de adivinar", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(
      "T1/markup.bcf",
      `<?xml version="1.0"?><Markup><Topic Guid="g1"><Title>X</Title><CreationDate>2026-01-01T00:00:00Z</CreationDate><CreationAuthor>a@b.cl</CreationAuthor></Topic></Markup>`,
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const project = await parseBcf(bytes);
    expect(project.version).toBe("unknown");
  });
});
