// src/viewer/SnapDetector.ts
import * as THREE from "three";
import { SnappingClass } from "@thatopen/fragments";
import type { FragmentsModel, RaycastResult } from "@thatopen/fragments";

export type SnapType = "vertex" | "edge" | "plane";

export interface SnapPoint {
  type: SnapType;
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  edgeStart?: THREE.Vector3;
  edgeEnd?: THREE.Vector3;
}

const SNAP_TYPE_BY_CLASS: Record<SnappingClass, SnapType> = {
  [SnappingClass.POINT]: "vertex",
  [SnappingClass.LINE]: "edge",
  [SnappingClass.FACE]: "plane",
};

const SNAPPING_CLASSES = [SnappingClass.POINT, SnappingClass.LINE, SnappingClass.FACE];

// Wrapper fino sobre model.raycastWithSnapping (la API real y soportada para
// esto) - NO reimplementa raycasting/iteración de vértices a mano. Un
// SnapDetector "manual" (Raycaster.intersectObject + recorrer
// geometry.attributes.position) fue la primera versión que se consideró acá,
// pero se descartó tras leer el código fuente real de @thatopen/fragments:
// la geometría de un modelo cargado vive en THREE.BatchedMesh compartidos
// entre miles de elementos (streaming por tiles), así que "recorrer todos
// los vértices" en cada mousemove iteraría decenas de miles de posiciones
// sin corresponder a las esquinas reales de un elemento - y para geometría
// instanciada, ignorar la matriz de la instancia específica (en vez de
// hit.object.matrixWorld) da posiciones mundiales directamente incorrectas.
// raycastWithSnapping resuelve todo esto en un worker thread, ya devuelve
// snappedEdgeP1/P2 reales para aristas, y es el mismo mecanismo que usan
// GraphicVertexPicker/LengthMeasurement en @thatopen/components-front.
export class SnapDetector {
  private camera: THREE.Camera;
  private dom: HTMLCanvasElement;

  constructor(camera: THREE.Camera, dom: HTMLCanvasElement) {
    this.camera = camera;
    this.dom = dom;
  }

  async detectSnap(models: Iterable<FragmentsModel>, clientX: number, clientY: number): Promise<SnapPoint | null> {
    const mouse = new THREE.Vector2(clientX, clientY);

    let best: SnapPoint | null = null;
    let bestRayDistance = Infinity;

    for (const model of models) {
      let results: RaycastResult[] | null;
      try {
        results = await model.raycastWithSnapping({
          // El tipo público de World.camera.three es THREE.Camera (genérico);
          // en la práctica siempre es Perspective u Orthographic, misma
          // asunción que ya hace el raycast simple existente en Viewport.tsx.
          camera: this.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
          dom: this.dom,
          mouse,
          snappingClasses: SNAPPING_CLASSES,
        });
      } catch (error) {
        console.error("❌ Error en raycastWithSnapping:", error);
        continue;
      }
      if (!results) continue;

      for (const hit of results) {
        const rayDistance = hit.rayDistance ?? hit.distance;
        if (rayDistance >= bestRayDistance) continue;

        bestRayDistance = rayDistance;
        best = {
          type: SNAP_TYPE_BY_CLASS[hit.snappingClass] ?? "plane",
          position: hit.point,
          normal: hit.normal,
          edgeStart: hit.snappedEdgeP1,
          edgeEnd: hit.snappedEdgeP2,
        };
      }
    }

    return best;
  }
}
