// src/engine/adapters/ThatOpenModelLoaderAdapter.ts
import * as OBC from "@thatopen/components";
import { IfcBootstrap } from "../../core/IfcBootstrap";

export interface ModelProgress {
  readonly percentage: number;
  readonly statusMessage: string;
}

export interface ImportedModelInfo {
  readonly id: string;
  readonly name: string;
  readonly byteSize: number;
}

export class IfcLoaderAdapter {
  async load(
    rawBytes: Uint8Array,
    modelName: string,
    onProgress?: (progress: ModelProgress) => void
  ): Promise<ImportedModelInfo> {
    try {
      if (onProgress) {
        onProgress({ percentage: 10, statusMessage: "Inicializando decodificador de mallas..." });
      }

      const loader = IfcBootstrap.loader;

      if (onProgress) {
        onProgress({ percentage: 30, statusMessage: "Inyectando geometría en memoria activa..." });
      }

      const model = await loader.load(rawBytes, true, modelName, {
        processData: {
          progressCallback: (fraction: number) => {
            if (onProgress) {
              const pct = Math.round(30 + (fraction * 70));
              onProgress({
                percentage: pct,
                statusMessage: `Indexando elementos geométricos (${pct}%)`
              });
            }
          },
        },
      });

      const modelId = model?.modelId || crypto.randomUUID();

      if (onProgress) {
        onProgress({ percentage: 100, statusMessage: "¡Modelo coordinado con éxito!" });
      }

      return {
        id: modelId,
        name: modelName,
        byteSize: rawBytes.length
      };

    } catch (error) {
      console.error("Fallo crítico en el adaptador de carga:", error);
      throw new Error(`Error al procesar el modelo: ${error instanceof Error ? error.message : "Desconocido"}`);
    }
  }

  /**
   * Muestra u oculta un modelo completo, usando Hider en vez de
   * model.object.visible. Object3D.visible solo afecta el renderizado
   * (lo que se dibuja), pero NO al sistema interno de selección/raycasting
   * de la librería - un modelo "oculto" así seguía siendo seleccionable e
   * interceptaba clics destinados a otros modelos, causando que la
   * selección de otros modelos pareciera fallar aleatoriamente. Hider.set()
   * coordina ambas cosas correctamente.
   */
  async setModelVisibility(modelId: string, visible: boolean): Promise<void> {
    const fragments = IfcBootstrap.fragments;
    const model = fragments.list.get(modelId);

    if (!model) {
      console.warn(`[Adapter] No se encontró el modelo "${modelId}" para cambiar su visibilidad.`);
      return;
    }

    const hider = IfcBootstrap.loader.components.get(OBC.Hider);
    const localIds = await model.getLocalIds();

    await hider.set(visible, { [modelId]: new Set(localIds) });
  }

  /**
   * Muestra u oculta un elemento individual (no el modelo completo) - mismo
   * mecanismo de Hider que setModelVisibility, pero acotado a un solo
   * localId en vez de todos los de un modelo.
   */
  async setElementVisibility(modelId: string, localId: number, visible: boolean): Promise<void> {
    const hider = IfcBootstrap.loader.components.get(OBC.Hider);
    await hider.set(visible, { [modelId]: new Set([localId]) });
  }

  async unloadModel(modelId: string): Promise<void> {
    const fragments = IfcBootstrap.fragments;

    try {
      await fragments.core.disposeModel(modelId);
    } catch (error) {
      console.error(`[Adapter] Error al descargar el modelo "${modelId}":`, error);
      throw error;
    }
  }
}
