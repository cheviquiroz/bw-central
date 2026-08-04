// src/viewer/ProximityManager.ts
import type { IfcViewerHandles } from "../core/IfcBootstrap";
import type { ApplicationInstance } from "../engine/createApplication";
import { setInitialDiagonalView } from "../core/IfcBootstrap";
import {
  detectDistantModels,
  type ModelBoundingBox,
} from "../engine/domain/federation/detectDistantModels";

/**
 * Detecta modelos federados cuya geometría real (bounding box, no un punto
 * de origen declarado) está lejos del resto, sin decidir cuál está "bien
 * ubicado" - solo agrupa por cercanía y reporta lo que queda afuera del
 * grupo principal (ver detectDistantModels).
 *
 * Usa model.box (ya calculado por la librería) transformado con
 * model.object.matrixWorld para obtener sus extremos reales en el espacio
 * de escena compartida - correcto sin importar si model.box venía en
 * espacio local o ya en espacio de escena, ya que aplicar una matriz
 * identidad no cambia nada.
 */
export class ProximityManager {
  private boundingBoxes: ModelBoundingBox[] = [];
  private app: ApplicationInstance;
  private hasSetInitialView = false;

  constructor(viewer: IfcViewerHandles, app: ApplicationInstance) {
    this.app = app;
    const { fragments } = viewer;

    fragments.core.onModelLoaded.add((model: any) => {
      const worldBox = model.box.clone().applyMatrix4(model.object.matrixWorld);

      this.boundingBoxes = this.boundingBoxes.filter((b) => b.modelId !== model.modelId);
      this.boundingBoxes.push({
        modelId: model.modelId,
        min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
        max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
      });

      this.recalculate();

      // Primera carga: vista diagonal 3/4 desde arriba. Cargas
      // posteriores: la cámara no se toca - se queda exactamente donde el
      // usuario la haya dejado. "Encuadrar todo" sigue siendo el único
      // mecanismo de reencuadre después de la primera carga, y es manual.
      if (!this.hasSetInitialView) {
        this.hasSetInitialView = true;
        setInitialDiagonalView();
      }
    });

    app.subscribeToModelUnloaded((modelId) => {
      this.boundingBoxes = this.boundingBoxes.filter((b) => b.modelId !== modelId);
      this.recalculate();
    });
  }

  private recalculate(): void {
    const warnings = detectDistantModels(this.boundingBoxes);
    this.app.setProximityWarnings(warnings);
  }
}
