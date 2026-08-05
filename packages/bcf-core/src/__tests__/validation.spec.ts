import { describe, test, expect } from "vitest";
import { validateProject, validateTopic, isProjectValid } from "../validation";
import type { BcfProject, BcfTopic } from "../types";

function validTopic(overrides: Partial<BcfTopic> = {}): BcfTopic {
  return {
    guid: "t-1",
    title: "Topic válido",
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

describe("validateTopic", () => {
  test("un topic bien formado no produce errores de severidad error", () => {
    const errors = validateTopic(validTopic());
    expect(errors.filter((e) => e.severity === "error")).toEqual([]);
  });

  test("detecta guid/title/creationDate/creationAuthor faltantes", () => {
    const errors = validateTopic({ ...validTopic(), guid: "", title: "", creationDate: "", creationAuthor: "" });
    const paths = errors.filter((e) => e.severity === "error").map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(["topic.guid", "topic.title", "topic.creationDate", "topic.creationAuthor"]));
  });

  test("advierte (no error) si CreationDate no es una fecha parseable", () => {
    const errors = validateTopic({ ...validTopic(), creationDate: "no-es-fecha" });
    const dateError = errors.find((e) => e.path === "topic.creationDate");
    expect(dateError?.severity).toBe("warning");
  });

  test("advierte si un comentario referencia un viewpoint que no existe en el topic", () => {
    const topic = validTopic({
      comments: [{ guid: "c1", date: "2026-01-01T00:00:00Z", author: "a@b.cl", text: "hola", viewpointGuid: "vp-inexistente" }],
    });
    const errors = validateTopic(topic);
    expect(errors.some((e) => e.path.includes("viewpointGuid") && e.severity === "warning")).toBe(true);
  });

  test("no advierte si el comentario referencia un viewpoint que sí existe", () => {
    const topic = validTopic({
      viewpoints: [{ guid: "vp-1", clippingPlanes: [], components: { selection: [], coloring: [] } }],
      comments: [{ guid: "c1", date: "2026-01-01T00:00:00Z", author: "a@b.cl", text: "hola", viewpointGuid: "vp-1" }],
    });
    const errors = validateTopic(topic);
    expect(errors.some((e) => e.path.includes("viewpointGuid"))).toBe(false);
  });
});

describe("validateProject / isProjectValid", () => {
  test("un proyecto bien formado es válido", () => {
    const project: BcfProject = { version: "2.1", topics: [validTopic()] };
    expect(isProjectValid(project)).toBe(true);
  });

  test("detecta Guids de topic duplicados", () => {
    const project: BcfProject = { version: "2.1", topics: [validTopic(), validTopic()] };
    expect(isProjectValid(project)).toBe(false);
    expect(validateProject(project).some((e) => e.message.includes("duplicado"))).toBe(true);
  });

  test("un proyecto sin topics es válido pero con warning, no error", () => {
    const project: BcfProject = { version: "2.1", topics: [] };
    expect(isProjectValid(project)).toBe(true);
    expect(validateProject(project).some((e) => e.path === "topics" && e.severity === "warning")).toBe(true);
  });
});
