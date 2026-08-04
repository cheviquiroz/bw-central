// src/viewer/SelectionManager.ts
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { IfcViewerHandles } from "../core/IfcBootstrap";
import type { ApplicationInstance, SelectedElement } from "../engine/createApplication";

const XRAY_OPACITY = 0.1;

export class SelectionManager {
  private viewer: IfcViewerHandles;
  private app: ApplicationInstance;
  private currentSelectionByModel: Record<string, number[]> = {};
  private xrayEnabled = false;

  constructor(viewer: IfcViewerHandles, app: ApplicationInstance) {
    this.viewer = viewer;
    this.app = app;

    const { components, world, fragments } = this.viewer;

    components.get(OBC.Raycasters).get(world);
    const highlighter = components.get(OBF.Highlighter);

    highlighter.setup({
      world,
      selectMaterialDefinition: {
        color: new THREE.Color("#3b82f6"),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      },
    });

    highlighter.multiple = "shiftKey";

    highlighter.events.select.onHighlight.add(async (modelIdMap) => {
      // La selección cambió: si había X-Ray activo sobre la selección
      // anterior, hay que devolverle su opacidad antes de perder sus IDs,
      // si no quedaría un elemento fantasma atascado en 10% de opacidad.
      if (this.xrayEnabled) {
        await this.resetXray(this.currentSelectionByModel);
        this.xrayEnabled = false;
      }

      this.currentSelectionByModel = Object.fromEntries(
        Object.entries(modelIdMap).map(([modelId, localIds]) => [modelId, [...localIds]])
      );

      const elementsByModel: Record<string, SelectedElement[]> = {};

      for (const [modelId, localIds] of Object.entries(modelIdMap)) {
        const model = fragments.list.get(modelId);
        if (!model) continue;

        const expressIds = [...localIds];
        if (expressIds.length === 0) continue;

        try {
          const dataList = await model.getItemsData(expressIds, {
            attributesDefault: true,
            relations: {
              IsDefinedBy: { attributes: true, relations: true },
            },
          });

          const elements: SelectedElement[] = [];

          for (let i = 0; i < dataList.length; i++) {
            const elementData = dataList[i] as any;
            if (!elementData) continue;

            const expressId = expressIds[i];
            const elementGuid =
              elementData.GlobalId?.value ||
              elementData.GlobalId ||
              elementData.globalId?.value ||
              elementData.globalId ||
              `IFC-ELEMENT-${expressId}`;

            elements.push({ guid: elementGuid, localId: expressId, data: elementData });
          }

          elementsByModel[modelId] = elements;
        } catch (error) {
          console.error("❌ Error procesando los objetos seleccionados:", error);
        }
      }

      this.app.setSelection(elementsByModel);
    });

    highlighter.events.select.onClear.add(async () => {
      if (this.xrayEnabled) {
        await this.resetXray(this.currentSelectionByModel);
        this.xrayEnabled = false;
      }
      this.currentSelectionByModel = {};
      this.app.clearSelection();
    });

    // Permite que otras partes de la app (como el árbol IFC) pidan una
    // selección sin conocer al Highlighter directamente.
    app.subscribeToSelectionRequests((modelId, localId) => {
      highlighter.highlightByID(
        "select",
        { [modelId]: new Set([localId]) },
        true,  // removePrevious: reemplaza la selección, no la acumula
        false  // zoomToSelection: no mover la cámara (decisión ya tomada)
      );
    });

    // --- X-Ray (Spacebar): alterna opacidad reducida sobre la selección
    // actual. No hace nada si no hay selección activa.
    const handleXrayToggle = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (Object.keys(this.currentSelectionByModel).length === 0) return;

      event.preventDefault();
      this.xrayEnabled = !this.xrayEnabled;

      if (this.xrayEnabled) {
        this.applyXray(this.currentSelectionByModel);
      } else {
        this.resetXray(this.currentSelectionByModel);
      }
    };

    window.addEventListener("keydown", handleXrayToggle);
  }

  private async applyXray(selectionByModel: Record<string, number[]>): Promise<void> {
    const { fragments } = this.viewer;

    for (const [modelId, localIds] of Object.entries(selectionByModel)) {
      const model = fragments.list.get(modelId);
      if (!model || localIds.length === 0) continue;
      await model.setOpacity(localIds, XRAY_OPACITY);
    }

    fragments.core.update(true);
  }

  private async resetXray(selectionByModel: Record<string, number[]>): Promise<void> {
    const { fragments } = this.viewer;

    for (const [modelId, localIds] of Object.entries(selectionByModel)) {
      const model = fragments.list.get(modelId);
      if (!model || localIds.length === 0) continue;
      await model.resetOpacity(localIds);
    }

    fragments.core.update(true);
  }
}
