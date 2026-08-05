import type { Federation, FederatedModelEntry, ModelId } from "./types.js";

export type RegisterModelInFederationResult =
  | { success: true; value: Federation; resolvedName: string }
  | { success: false; error: string };

/**
 * Calcula un nombre disponible dentro de la Federación, agregando un
 * sufijo "(1)", "(2)", etc. si el nombre deseado ya está en uso por
 * OTRO modelo (contenido distinto, nombre casualmente repetido).
 */
function resolveAvailableName(federation: Federation, desiredName: string): string {
  const existingNames = new Set(federation.models.map((m) => m.name));
  if (!existingNames.has(desiredName)) return desiredName;

  const dotIndex = desiredName.lastIndexOf(".");
  const base = dotIndex > 0 ? desiredName.slice(0, dotIndex) : desiredName;
  const extension = dotIndex > 0 ? desiredName.slice(dotIndex) : "";

  let counter = 1;
  let candidate = `${base} (${counter})${extension}`;
  while (existingNames.has(candidate)) {
    counter++;
    candidate = `${base} (${counter})${extension}`;
  }
  return candidate;
}

/**
 * Regla de dominio: un modelo con el MISMO CONTENIDO (mismo ModelId,
 * derivado de su hash) no puede registrarse dos veces en la misma
 * Federación. Si el nombre deseado ya está en uso por otro modelo con
 * contenido distinto, se resuelve automáticamente un nombre disponible.
 */
export function registerModelInFederation(
  federation: Federation,
  modelId: ModelId,
  desiredName: string
): RegisterModelInFederationResult {
  const alreadyExists = federation.models.some((m) => m.id.equals(modelId));

  if (alreadyExists) {
    return { success: false, error: "Este archivo ya está registrado en la Federación (mismo contenido)." };
  }

  const resolvedName = resolveAvailableName(federation, desiredName);
  const newEntry: FederatedModelEntry = { id: modelId, name: resolvedName };

  return {
    success: true,
    resolvedName,
    value: {
      ...federation,
      models: [...federation.models, newEntry],
    },
  };
}

export type RemoveModelFromFederationResult =
  | { success: true; value: Federation }
  | { success: false; error: string };

/**
 * Regla de dominio: quita un modelo de la Federación por su identidad real
 * (ModelId, derivado del hash de contenido) - no por su nombre, ya que el
 * nombre puede haber sido resuelto automáticamente con un sufijo "(1)".
 * Simétrico a registerModelInFederation.
 */
export function removeModelFromFederation(
  federation: Federation,
  modelId: ModelId
): RemoveModelFromFederationResult {
  const exists = federation.models.some((m) => m.id.equals(modelId));

  if (!exists) {
    return { success: false, error: "Este modelo no está registrado en la Federación." };
  }

  return {
    success: true,
    value: {
      ...federation,
      models: federation.models.filter((m) => !m.id.equals(modelId)),
    },
  };
}
