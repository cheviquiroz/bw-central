import { ModelId } from "../domain/model/ModelId";
import { Model } from "../domain/model/Model";
import type { FederationRepository } from "../ports/FederationRepository";
import type { FederationId } from "../domain/federation/FederationId";
import { registerModelInFederation } from "../domain/federation/registerModelInFederation";

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

async function hashContent(content: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", content.buffer as ArrayBuffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const contentHash = await hashContent(input.content);
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
