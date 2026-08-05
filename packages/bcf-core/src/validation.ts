// Validación estructural de un BcfProject/BcfTopic - más allá de lo que ya
// garantiza el compilador (forma del objeto), chequea invariantes reales
// del formato: campos obligatorios del schema, fechas parseables,
// referencias cruzadas (Comment.viewpointGuid -> un viewpoint que
// realmente exista en el topic).

import type { BcfProject, BcfTopic } from "./types";

export type ValidationSeverity = "error" | "warning";

export interface ValidationError {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

function isParseableDate(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

/** Valida un único topic. `path` permite anidar el error dentro de validateProject. */
export function validateTopic(topic: BcfTopic, path = "topic"): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!topic.guid.trim()) {
    errors.push({ path: `${path}.guid`, message: "El topic no tiene Guid.", severity: "error" });
  }
  if (!topic.title.trim()) {
    errors.push({ path: `${path}.title`, message: "El topic no tiene Title.", severity: "error" });
  }
  if (!topic.creationDate.trim()) {
    errors.push({ path: `${path}.creationDate`, message: "El topic no tiene CreationDate.", severity: "error" });
  } else if (!isParseableDate(topic.creationDate)) {
    errors.push({ path: `${path}.creationDate`, message: `CreationDate "${topic.creationDate}" no es una fecha válida.`, severity: "warning" });
  }
  if (!topic.creationAuthor.trim()) {
    errors.push({ path: `${path}.creationAuthor`, message: "El topic no tiene CreationAuthor.", severity: "error" });
  }

  const viewpointGuids = new Set(topic.viewpoints.map((v) => v.guid).filter(Boolean));

  topic.comments.forEach((comment, i) => {
    const cPath = `${path}.comments[${i}]`;
    if (!comment.guid.trim()) errors.push({ path: `${cPath}.guid`, message: "El comentario no tiene Guid.", severity: "error" });
    if (!comment.author.trim()) errors.push({ path: `${cPath}.author`, message: "El comentario no tiene Author.", severity: "error" });
    if (!comment.text.trim()) errors.push({ path: `${cPath}.text`, message: "El comentario no tiene texto.", severity: "warning" });
    if (!comment.date.trim()) {
      errors.push({ path: `${cPath}.date`, message: "El comentario no tiene Date.", severity: "error" });
    } else if (!isParseableDate(comment.date)) {
      errors.push({ path: `${cPath}.date`, message: `Date "${comment.date}" no es una fecha válida.`, severity: "warning" });
    }
    if (comment.viewpointGuid && !viewpointGuids.has(comment.viewpointGuid)) {
      errors.push({
        path: `${cPath}.viewpointGuid`,
        message: `El comentario referencia el viewpoint "${comment.viewpointGuid}", que no existe en este topic.`,
        severity: "warning",
      });
    }
  });

  topic.viewpoints.forEach((vp, i) => {
    const vpPath = `${path}.viewpoints[${i}]`;
    if (!vp.guid.trim()) {
      errors.push({ path: `${vpPath}.guid`, message: "El viewpoint no tiene Guid.", severity: "warning" });
    }
    if (!vp.camera && vp.clippingPlanes.length === 0 && vp.components.selection.length === 0 && !vp.snapshot) {
      errors.push({ path: vpPath, message: "El viewpoint no tiene cámara, clipping planes, selección de componentes ni snapshot.", severity: "warning" });
    }
  });

  return errors;
}

/** Valida el proyecto completo: cada topic + Guids de topic duplicados. */
export function validateProject(project: BcfProject): ValidationError[] {
  const errors: ValidationError[] = [];

  if (project.topics.length === 0) {
    errors.push({ path: "topics", message: "El proyecto BCF no tiene ningún topic.", severity: "warning" });
  }

  const seenGuids = new Map<string, number>();
  project.topics.forEach((topic, i) => {
    if (topic.guid) {
      const count = seenGuids.get(topic.guid) ?? 0;
      seenGuids.set(topic.guid, count + 1);
      if (count === 1) {
        errors.push({ path: `topics[${i}].guid`, message: `Guid de topic duplicado: "${topic.guid}".`, severity: "error" });
      }
    }
    errors.push(...validateTopic(topic, `topics[${i}]`));
  });

  return errors;
}

/** true si el proyecto no tiene ningún error de severidad "error" (los warnings no bloquean). */
export function isProjectValid(project: BcfProject): boolean {
  return validateProject(project).every((e) => e.severity !== "error");
}
