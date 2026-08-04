// src/viewer/EntitySelector.ts
import * as THREE from "three";
import * as OBF from "@thatopen/components-front";
import type { IfcViewerHandles } from "../core/IfcBootstrap";

const HOLD_DURATION_MS = 2000;
const MOVE_THRESHOLD_PX = 5;

export interface SelectionBoxState {
  startX: number; // vértice inicial, coordenadas de pantalla (clientX/clientY)
  startY: number;
  currentX: number; // posición actual del cursor
  currentY: number;
}

/**
 * Left-hold 2s sin moverse entra en "modo selección": aparece un vértice
 * fijo en la posición donde se cumplieron los 2s, y el rectángulo crece
 * desde ahí hasta donde esté el cursor en cada momento (estilo
 * drag-to-select / marquee). Cada movimiento dispara un
 * rectangleRaycast contra los modelos cargados y resalta en vivo lo
 * encontrado reusando el estilo "select" del Highlighter (el mismo que
 * usa la selección normal, ver SelectionManager.ts) - lo que se ve
 * resaltado durante el arrastre YA ES la selección real en cada
 * instante. Al soltar, se dispara un último raycast con el rectángulo
 * final antes de cerrar el modo selección, para no quedarse con el
 * resultado de un raycast anterior a medio resolver.
 *
 * Convive con la selección normal (click) sin pisarla: nada acá llama
 * preventDefault/stopPropagation, y el hold se cancela apenas hay más de
 * MOVE_THRESHOLD_PX de movimiento antes de que se cumplan los 2s (eso ya
 * es un drag real - orbit -, no un hold).
 */
export class EntitySelector {
  private viewer: IfcViewerHandles;
  private container: HTMLElement;
  private onSelectionBoxChange: (box: SelectionBoxState | null) => void;

  private holdTimer: number | null = null;
  private startPosition = { x: 0, y: 0 };
  private selectionActive = false;
  private raycastInFlight = false;

  constructor(
    viewer: IfcViewerHandles,
    container: HTMLElement,
    onSelectionBoxChange: (box: SelectionBoxState | null) => void,
  ) {
    this.viewer = viewer;
    this.container = container;
    this.onSelectionBoxChange = onSelectionBoxChange;

    container.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;

    this.startPosition = { x: event.clientX, y: event.clientY };
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      this.startSelectionMode(event.clientX, event.clientY);
    }, HOLD_DURATION_MS);
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.holdTimer !== null) {
      const dx = event.clientX - this.startPosition.x;
      const dy = event.clientY - this.startPosition.y;
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) {
        this.cancelHold();
      }
      return;
    }

    if (this.selectionActive) {
      this.onSelectionBoxChange({
        startX: this.startPosition.x,
        startY: this.startPosition.y,
        currentX: event.clientX,
        currentY: event.clientY,
      });
      this.runRectangleRaycast(this.startPosition.x, this.startPosition.y, event.clientX, event.clientY);
    }
  };

  private handleMouseUp = (event: MouseEvent): void => {
    this.cancelHold();

    if (this.selectionActive) {
      this.selectionActive = false;
      this.container.style.cursor = "";
      this.setOrbitEnabled(true);
      // Último raycast con el rectángulo final, sin esperar a que el
      // último mousemove (que puede seguir en vuelo) termine de resolver.
      this.runRectangleRaycast(this.startPosition.x, this.startPosition.y, event.clientX, event.clientY);
      this.onSelectionBoxChange(null);
    }
  };

  private cancelHold(): void {
    if (this.holdTimer !== null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private startSelectionMode(clientX: number, clientY: number): void {
    this.selectionActive = true;
    this.container.style.cursor = "crosshair";
    this.setOrbitEnabled(false);
    // El vértice ya queda fijo en startPosition (guardado en mousedown);
    // el rectángulo arranca en tamaño 0, ahí mismo.
    this.onSelectionBoxChange({
      startX: this.startPosition.x,
      startY: this.startPosition.y,
      currentX: clientX,
      currentY: clientY,
    });
  }

  // mouseButtons.left = ACTION.ROTATE es lo que hace que un left-drag
  // orbite (ver IfcBootstrap.ts). Mientras se arma el rectángulo de
  // selección, el mouse SIGUE apretado y moviéndose - sin este bloqueo,
  // camera-controls orbitaría la cámara al mismo tiempo que se arrastra
  // el rectángulo, porque re-lee mouseButtons.left en cada pointermove
  // (confirmado leyendo la implementación real: this._state se recalcula
  // por evento, no se cachea una sola vez en el mousedown - por eso este
  // cambio a mitad de gesto sí tiene efecto inmediato, no llega tarde).
  private setOrbitEnabled(enabled: boolean): void {
    const controls = this.viewer.world.camera.controls as any;
    if (!controls) return;
    const ACTION = (controls.constructor as any).ACTION;
    controls.mouseButtons.left = enabled ? ACTION.ROTATE : ACTION.NONE;
  }

  private async runRectangleRaycast(
    startX: number, startY: number, endX: number, endY: number,
  ): Promise<void> {
    // Si el mouse se mueve más rápido de lo que tarda en resolver un
    // raycast anterior, se descarta el nuevo pedido en vez de encolarlo -
    // el próximo mousemove ya va a disparar uno con la posición actual.
    if (this.raycastInFlight) return;
    this.raycastInFlight = true;

    try {
      const { world, fragments, components } = this.viewer;
      if (!world.renderer) return;

      const dom = world.renderer.three.domElement;

      // rectangleRaycast espera coordenadas de pantalla crudas
      // (clientX/clientY), NO NDC - la conversión la hace la librería
      // internamente contra el getBoundingClientRect() de `dom`
      // (confirmado leyendo screenToCast() en el bundle real).
      const topLeft = new THREE.Vector2(Math.min(startX, endX), Math.min(startY, endY));
      const bottomRight = new THREE.Vector2(Math.max(startX, endX), Math.max(startY, endY));

      const modelIdMap: Record<string, Set<number>> = {};

      // Si el usuario mueve el rectángulo fuera de cualquier modelo, no
      // hace falta ningún caso especial: rectangleRaycast simplemente no
      // encuentra nada en esa zona y modelIdMap queda vacío, igual que un
      // rectángulo minúsculo que no llega a tocar geometría.
      for (const model of fragments.list.values() as any) {
        const result = await model.rectangleRaycast({
          camera: world.camera.three,
          dom,
          topLeft,
          bottomRight,
          fullyIncluded: false, // cuenta lo que toca el rectángulo, no solo lo que está 100% adentro
        });

        if (result && result.localIds.length > 0) {
          modelIdMap[model.modelId] = new Set(result.localIds);
        }
      }

      const highlighter = components.get(OBF.Highlighter);
      if (Object.keys(modelIdMap).length > 0) {
        await highlighter.highlightByID("select", modelIdMap, true, false);
      } else {
        await highlighter.clear("select");
      }
    } catch (error) {
      console.error("❌ Error en el raycast del selector de entidades:", error);
    } finally {
      this.raycastInFlight = false;
    }
  }

  dispose(): void {
    this.container.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    this.cancelHold();
    this.container.style.cursor = "";
    if (this.selectionActive) {
      this.setOrbitEnabled(true);
    }
  }
}
