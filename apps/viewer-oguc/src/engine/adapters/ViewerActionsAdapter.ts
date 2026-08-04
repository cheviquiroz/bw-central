// src/engine/adapters/ViewerActionsAdapter.ts
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type * as THREE from "three";
import type { IfcViewerHandles } from "../../core/IfcBootstrap";
import { AxesHelper } from "../../viewer/AxesHelper";

export class ViewerActionsAdapter {
  private components: OBC.Components;
  private hider: OBC.Hider;
  private scene: THREE.Object3D;
  private isElementIsolated: boolean = false;
  private isClipActive: boolean = false;
  private isClipVisible: boolean = true;
  private axesHelper: AxesHelper | null = null;

  constructor(handles: IfcViewerHandles) {
    this.components = handles.components;
    this.hider = this.components.get(OBC.Hider);
    this.scene = handles.world.scene.three;
  }

  // Compacta la selección actual del Highlighter (agrupada por estilo) a
  // un solo mapa modelId -> localIds.
  private getCurrentSelection(): Record<string, Set<number>> {
    const highlighter = this.components.get(OBF.Highlighter);
    const selectionGroups = highlighter.selection;
    const merged: Record<string, Set<number>> = {};

    for (const group of Object.values(selectionGroups)) {
      for (const [modelId, idSet] of Object.entries(group)) {
        if (!merged[modelId]) {
          merged[modelId] = new Set<number>();
        }
        for (const id of idSet) {
          merged[modelId].add(id);
        }
      }
    }

    return merged;
  }

  public toggleIsolate(viewportElement: HTMLElement, isolateButton: HTMLElement): void {
    const merged = this.getCurrentSelection();
    const hasSelection = Object.keys(merged).length > 0;

    if (!hasSelection && !this.isElementIsolated) {
      console.warn("Selecciona un elemento en el modelo antes de intentar aislarlo.");
      return;
    }

    if (!this.isElementIsolated) {
      this.isElementIsolated = true;
      viewportElement.classList.add("isolating");
      isolateButton.classList.add("active");
      this.hider.isolate(merged);
    } else {
      this.isElementIsolated = false;
      viewportElement.classList.remove("isolating");
      isolateButton.classList.remove("active");
      this.hider.set(true);
    }
  }

  public toggleClipPlane(clipButton: HTMLElement): void {
    const clipper = this.components.get(OBC.Clipper);

    this.isClipActive = !this.isClipActive;
    clipper.enabled = this.isClipActive;

    if (this.isClipActive) {
      clipButton.classList.add("active");
    } else {
      // Al desactivar, también se borran los planos existentes: el botón
      // "apagado" no debería dejar un corte fantasma en la escena.
      clipper.deleteAll();
      clipButton.classList.remove("active");
      // Los planos nuevos siempre nacen visibles - si quedaba "escondido"
      // de una sesión anterior, no debería arrancar así la próxima vez.
      this.isClipVisible = true;
      clipper.visible = true;
    }
  }

  public toggleClipperVisibility(hideButton: HTMLElement): void {
    const clipper = this.components.get(OBC.Clipper);

    this.isClipVisible = !this.isClipVisible;
    clipper.visible = this.isClipVisible;
    hideButton.classList.toggle("active", !this.isClipVisible);
  }

  public toggleAxes(axesButton: HTMLElement): void {
    if (!this.axesHelper) {
      this.axesHelper = new AxesHelper(this.scene);
    }

    this.axesHelper.toggle();
    axesButton.classList.toggle("active", this.axesHelper.isShown());
  }
}
