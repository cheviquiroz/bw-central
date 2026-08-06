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

  // Devuelve el nuevo estado (true = quedó aislado) en vez de mutar el DOM
  // del botón directamente (isolateButton.classList.add/remove, como
  // estaba antes) - ese patrón dejaba el "active" del botón fuera del
  // modelo de React: cualquier re-render de Toolbar por una razón
  // completamente ajena (tipear en el buscador, que cambie la selección,
  // un mensaje de progreso de carga) recomputa className desde cero sin
  // saber que esa clase existía, y la pisa. El caller (Layout.tsx) ahora
  // guarda este valor en useState y lo pasa como prop isActive - una sola
  // fuente de verdad real (este campo privado), React solo la refleja.
  public toggleIsolate(viewportElement: HTMLElement): boolean {
    const merged = this.getCurrentSelection();
    const hasSelection = Object.keys(merged).length > 0;

    if (!hasSelection && !this.isElementIsolated) {
      console.warn("Selecciona un elemento en el modelo antes de intentar aislarlo.");
      return this.isElementIsolated;
    }

    if (!this.isElementIsolated) {
      this.isElementIsolated = true;
      viewportElement.classList.add("isolating");
      this.hider.isolate(merged);
    } else {
      this.isElementIsolated = false;
      viewportElement.classList.remove("isolating");
      this.hider.set(true);
    }
    return this.isElementIsolated;
  }

  public toggleClipPlane(): boolean {
    const clipper = this.components.get(OBC.Clipper);

    this.isClipActive = !this.isClipActive;
    clipper.enabled = this.isClipActive;

    if (!this.isClipActive) {
      // Al desactivar, también se borran los planos existentes: el botón
      // "apagado" no debería dejar un corte fantasma en la escena.
      clipper.deleteAll();
      // Los planos nuevos siempre nacen visibles - si quedaba "escondido"
      // de una sesión anterior, no debería arrancar así la próxima vez.
      this.isClipVisible = true;
      clipper.visible = true;
    }
    return this.isClipActive;
  }

  // El botón "activo" acá representa "el plano está OCULTO" (lo inverso
  // de isClipVisible) - mismo significado que el classList.toggle original,
  // solo que ahora el caller recibe el booleano ya resuelto en vez de
  // tener que conocer esta inversión de signo por su cuenta.
  public toggleClipperVisibility(): boolean {
    const clipper = this.components.get(OBC.Clipper);

    this.isClipVisible = !this.isClipVisible;
    clipper.visible = this.isClipVisible;
    return !this.isClipVisible;
  }

  public toggleAxes(): boolean {
    if (!this.axesHelper) {
      this.axesHelper = new AxesHelper(this.scene);
    }

    this.axesHelper.toggle();
    return this.axesHelper.isShown();
  }
}
