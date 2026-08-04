import type { Federation } from "./Federation";
import type { ModelId } from "../model/ModelId";

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
