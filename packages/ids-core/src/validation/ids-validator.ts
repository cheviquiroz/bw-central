// Validación de documentos/especificaciones IDS 1.0 contra las reglas
// reales del esquema (ver comentarios en src/types/ids.ts), no solo
// contra la forma del objeto TypeScript (eso ya lo garantiza el compilador).

import type { IdsDocument, Specification } from "../types/ids";

export type ValidationSeverity = "error" | "warning";

export interface ValidationError {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

/**
 * El propio XSD oficial de IDS 1.0 restringe <info><author> con el patrón
 * `[^@]+@[^\.]+\..+`. Este regex es un poco más estricto (sin espacios)
 * pero cualquier valor que lo cumpla también cumple el del XSD - mismo
 * regex que ya usaba ids-builder (EMAIL_REGEX en ids_builder_questions.ts).
 */
const AUTHOR_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** dataType debe ser "the name of an IFC Defined Type, all uppercase" (Schema/ids.xsd). */
const IFC_DATATYPE_PATTERN = /^[A-Z]+$/;

const IFC_ENTITY_NAME_PATTERN = /^IFC[A-Z]+$/i;

/** Valida una única <specification> contra las reglas del esquema. `path` permite anidar el error dentro de validateDocument. */
export function validateSpecification(spec: Specification, path = "specification"): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!spec.name.trim()) {
    errors.push({ path: `${path}.name`, message: "El nombre de la especificación no puede estar vacío.", severity: "error" });
  }

  const entityName = spec.applicability.entity.name;
  if (!entityName.trim()) {
    errors.push({
      path: `${path}.applicability.entity.name`,
      message: "La entidad de applicability no puede estar vacía.",
      severity: "error",
    });
  } else if (!IFC_ENTITY_NAME_PATTERN.test(entityName)) {
    errors.push({
      path: `${path}.applicability.entity.name`,
      message: `"${entityName}" no parece una clase IFC real (se esperaba algo como IFCWALL).`,
      severity: "warning",
    });
  }

  const requirementCount =
    (spec.requirements.classifications?.length ?? 0) +
    (spec.requirements.attributes?.length ?? 0) +
    (spec.requirements.properties?.length ?? 0) +
    (spec.requirements.materials?.length ?? 0);

  if (requirementCount === 0) {
    errors.push({
      path: `${path}.requirements`,
      message: "La especificación no exige ningún requisito (classification/attribute/property/material).",
      severity: "warning",
    });
  }

  spec.requirements.properties?.forEach((prop, i) => {
    const propPath = `${path}.requirements.properties[${i}]`;
    if (!prop.propertySet.trim()) {
      errors.push({ path: `${propPath}.propertySet`, message: "propertySet no puede estar vacío.", severity: "error" });
    }
    if (!prop.baseName.trim()) {
      errors.push({ path: `${propPath}.baseName`, message: "baseName no puede estar vacío.", severity: "error" });
    }
    if (!IFC_DATATYPE_PATTERN.test(prop.dataType)) {
      errors.push({
        path: `${propPath}.dataType`,
        message: `dataType "${prop.dataType}" debe ser un IFC Defined Type real en mayúsculas (p.ej. IFCLABEL).`,
        severity: "error",
      });
    }
  });

  spec.requirements.attributes?.forEach((attr, i) => {
    if (!attr.name.trim()) {
      errors.push({
        path: `${path}.requirements.attributes[${i}].name`,
        message: "El nombre del atributo no puede estar vacío.",
        severity: "error",
      });
    }
  });

  spec.requirements.classifications?.forEach((c, i) => {
    const cPath = `${path}.requirements.classifications[${i}]`;
    if (!c.system.trim()) errors.push({ path: `${cPath}.system`, message: "system no puede estar vacío.", severity: "error" });
    if (!c.value.trim()) errors.push({ path: `${cPath}.value`, message: "value no puede estar vacío.", severity: "error" });
  });

  return errors;
}

/** true si la especificación no tiene ningún error de severidad "error" (los warnings no bloquean). */
export function validateAgainstSchema(spec: Specification): boolean {
  return validateSpecification(spec).every((e) => e.severity !== "error");
}

/** Valida el documento completo: metadata de <info> + cada <specification>. */
export function validateDocument(doc: IdsDocument): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!doc.info.title.trim()) {
    errors.push({ path: "info.title", message: "El título del documento IDS no puede estar vacío.", severity: "error" });
  }
  if (!AUTHOR_EMAIL_REGEX.test(doc.info.author)) {
    errors.push({
      path: "info.author",
      message: `"${doc.info.author}" no es un email válido (el XSD oficial de IDS 1.0 exige el patrón [^@]+@[^.]+\\..+).`,
      severity: "error",
    });
  }
  if (doc.specifications.length === 0) {
    errors.push({ path: "specifications", message: "El documento IDS no tiene ninguna especificación.", severity: "error" });
  }

  doc.specifications.forEach((spec, i) => {
    errors.push(...validateSpecification(spec, `specifications[${i}]`));
  });

  return errors;
}

/** true si el documento completo no tiene ningún error de severidad "error". */
export function isDocumentValid(doc: IdsDocument): boolean {
  return validateDocument(doc).every((e) => e.severity !== "error");
}
