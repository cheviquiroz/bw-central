import { ModelId, Model, calculateSHA256, registerModelInFederation } from "@bw-central/ifc-core";
import type { FederationId } from "@bw-central/ifc-core";
import type { FederationRepository } from "../ports/FederationRepository";

export interface ModelProgress {
  readonly percentage: number;
  readonly statusMessage: string;
}

export interface ModelLoader {
  load(
    content: Uint8Array,
    name: string,
    onProgress?: (progress: ModelProgress) => void
  ): Promise<{ id: string; name: string; byteSize: number }>;
}

export type RegisterModelResult =
  | { success: true; value: Model; technicalModelId: string }
  | { success: false; error: string };

export interface RegisterModelInput {
  name: string;
  content: Uint8Array;
  federationId: FederationId;
}

/**
 * Caso de Uso: Registrar e importar un modelo a la Federación,
 * protegiendo la invariante de no permitir el mismo archivo dos veces,
 * y resolviendo automáticamente nombres repetidos entre archivos distintos.
 */
export async function registerModel(
  input: RegisterModelInput,
  ifcLoaderAdapter: ModelLoader,
  federationRepository: FederationRepository,
  onProgress?: (progress: ModelProgress) => void
): Promise<RegisterModelResult> {

  if (!input.content || input.content.length === 0) {
    return { success: false, error: "El archivo del modelo está vacío o corrupto." };
  }

  const federation = await federationRepository.get(input.federationId);
  if (!federation) {
    return { success: false, error: "La Federación indicada no existe." };
  }

  const contentHash = await calculateSHA256(input.content);
  const modelId = new ModelId(contentHash);

  const registrationResult = registerModelInFederation(federation, modelId, input.name);
  if (!registrationResult.success) {
    return { success: false, error: registrationResult.error };
  }

  try {
    const loadResult = await ifcLoaderAdapter.load(input.content, registrationResult.resolvedName, onProgress);

    const newModel = new Model({
      id: modelId,
      name: registrationResult.resolvedName,
    });

    await federationRepository.save(registrationResult.value);

    return { success: true, value: newModel, technicalModelId: loadResult.id };

  } catch (err: any) {
    return {
      success: false,
      error: `Error al procesar el modelo en la Federación: ${err.message || err}`
    };
  }
}
