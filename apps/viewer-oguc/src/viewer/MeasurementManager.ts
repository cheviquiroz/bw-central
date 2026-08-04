// src/viewer/MeasurementManager.ts
import * as THREE from "three";
import type { SnapPoint } from "./SnapDetector";

export type MeasurementType = "distance" | "area";

export interface Measurement {
  id: string;
  type: MeasurementType;
  points: THREE.Vector3[];
  value: number;
  unit: string;
  timestamp: number;
}

const POINT_MARKER_RADIUS = 0.05;
const DISTANCE_COLOR = 0xff0000;
const AREA_LINE_COLOR = 0x0066ff;
const AREA_PREVIEW_COLOR = 0xffaa00;
const SNAP_COLOR = 0xff0000;
const SNAP_VERTEX_RADIUS = 0.08;
const SNAP_PLANE_SIZE = 0.15;

export class MeasurementManager {
  private scene: THREE.Object3D;
  private measurements: Measurement[] = [];
  private currentPoints: THREE.Vector3[] = [];
  private currentMode: MeasurementType = "distance";
  private measurementGroup: THREE.Group;
  private onMeasurementAdded?: (measurement: Measurement) => void;
  private onCurrentPointsChanged?: (count: number) => void;
  private currentSnap: SnapPoint | null = null;
  private snapVisual: THREE.Object3D | null = null;
  private hoverPreviewLine: THREE.Object3D | null = null;
  // Cada visual (line/mesh/marker) se guarda acá, keyed por measurement.id,
  // para poder disponer geometrías/materiales reales al limpiar - el
  // Object3D.remove() por sí solo no libera memoria de GPU.
  private visualsByMeasurementId = new Map<string, THREE.Object3D[]>();

  constructor(scene: THREE.Object3D) {
    this.scene = scene;
    this.measurementGroup = new THREE.Group();
    this.measurementGroup.name = "measurement-group";
    this.scene.add(this.measurementGroup);
  }

  setMode(mode: MeasurementType): void {
    this.currentMode = mode;
    this.resetCurrentPoints();
  }

  addPoint(worldPosition: THREE.Vector3): void {
    this.currentPoints.push(worldPosition.clone());
    this.addPointMarker(worldPosition);
    this.onCurrentPointsChanged?.(this.currentPoints.length);
    // El rubber-band apuntaba al punto viejo hasta el próximo mousemove -
    // se limpia acá para no dejarlo "pegado" un frame de más.
    this.updateHoverPosition(null);

    if (this.currentMode === "distance" && this.currentPoints.length === 2) {
      this.completeMeasurement("distance");
    } else if (this.currentMode === "area" && this.currentPoints.length >= 3) {
      this.visualizeCurrentAreaPreview();
    }
  }

  // Permite cerrar una medición de área con el punto actual (ej. doble
  // click, o un botón "Terminar" en la UI) sin esperar un límite fijo de
  // vértices - una habitación puede tener cualquier cantidad de esquinas.
  completeCurrentMeasurement(): void {
    if (this.currentMode === "area" && this.currentPoints.length >= 3) {
      this.completeMeasurement("area");
    }
  }

  private completeMeasurement(type: MeasurementType): void {
    if (type === "distance" && this.currentPoints.length !== 2) return;
    if (type === "area" && this.currentPoints.length < 3) return;

    const points = [...this.currentPoints];
    const value = type === "distance" ? points[0].distanceTo(points[1]) : this.calculatePolygonArea(points);

    const measurement: Measurement = {
      id: `measure-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      type,
      points,
      value,
      unit: type === "distance" ? "m" : "m²",
      timestamp: Date.now(),
    };

    this.measurements.push(measurement);
    this.visualizeMeasurement(measurement);
    this.onMeasurementAdded?.(measurement);

    this.resetCurrentPoints();
  }

  private addPointMarker(point: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(POINT_MARKER_RADIUS, 12, 12);
    const color = this.currentMode === "distance" ? DISTANCE_COLOR : AREA_LINE_COLOR;
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(point);
    marker.renderOrder = 999;
    marker.userData.isCurrentPreview = true;
    this.measurementGroup.add(marker);
  }

  private visualizeCurrentAreaPreview(): void {
    this.clearPreviewLine();

    const geometry = new THREE.BufferGeometry().setFromPoints([...this.currentPoints, this.currentPoints[0]]);
    const material = new THREE.LineBasicMaterial({ color: AREA_PREVIEW_COLOR, depthTest: false });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 999;
    line.userData.isAreaPreviewLine = true;
    this.measurementGroup.add(line);
  }

  private clearPreviewLine(): void {
    const stale = this.measurementGroup.children.filter((child) => child.userData.isAreaPreviewLine);
    for (const child of stale) {
      this.measurementGroup.remove(child);
      this.disposeObject(child);
    }
  }

  private visualizeMeasurement(measurement: Measurement): void {
    if (measurement.type === "distance") {
      this.visualizeDistance(measurement);
    } else {
      this.visualizeArea(measurement);
    }
  }

  private visualizeDistance(measurement: Measurement): void {
    const [p1, p2] = measurement.points;

    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const material = new THREE.LineBasicMaterial({ color: DISTANCE_COLOR, depthTest: false });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 999;
    line.userData.measurementId = measurement.id;
    this.measurementGroup.add(line);

    this.visualsByMeasurementId.set(measurement.id, [line]);
  }

  private visualizeArea(measurement: Measurement): void {
    const points = measurement.points;
    const visuals: THREE.Object3D[] = [];

    // Triangulación en abanico desde points[0] - suficiente para polígonos
    // convexos y la mayoría de plantas de habitación reales; no maneja
    // polígonos cóncavos correctamente (mismo alcance que el cálculo de
    // área, que usa el mismo abanico).
    const positions: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      positions.push(
        points[0].x, points[0].y, points[0].z,
        points[i].x, points[i].y, points[i].z,
        points[i + 1].x, points[i + 1].y, points[i + 1].z,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: AREA_LINE_COLOR,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const polygon = new THREE.Mesh(geometry, material);
    polygon.renderOrder = 998;
    polygon.userData.measurementId = measurement.id;
    this.measurementGroup.add(polygon);
    visuals.push(polygon);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: AREA_LINE_COLOR, depthTest: false });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = 999;
    line.userData.measurementId = measurement.id;
    this.measurementGroup.add(line);
    visuals.push(line);

    this.visualsByMeasurementId.set(measurement.id, visuals);
  }

  // Suma de áreas de triángulos en abanico desde points[0] - las
  // iteraciones i=0 e i=length-1 son degeneradas a propósito (triángulo de
  // área cero), no un error: cubren correctamente los bordes del abanico
  // sin necesitar casos especiales. Verificado a mano con un cuadrado
  // unitario antes de usarlo (da área 1.0 exacto).
  private calculatePolygonArea(points: THREE.Vector3[]): number {
    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const v1 = new THREE.Vector3().subVectors(p1, points[0]);
      const v2 = new THREE.Vector3().subVectors(p2, points[0]);
      const cross = new THREE.Vector3().crossVectors(v1, v2);
      area += cross.length() / 2;
    }

    return area;
  }

  getMeasurements(): Measurement[] {
    return [...this.measurements];
  }

  getCurrentMode(): MeasurementType {
    return this.currentMode;
  }

  clearMeasurement(id: string): void {
    const index = this.measurements.findIndex((m) => m.id === id);
    if (index === -1) return;

    const visuals = this.visualsByMeasurementId.get(id) ?? [];
    for (const visual of visuals) {
      this.measurementGroup.remove(visual);
      this.disposeObject(visual);
    }
    this.visualsByMeasurementId.delete(id);
    this.measurements.splice(index, 1);
  }

  // Cancela solo la medición EN CURSO (puntos ya clickeados que todavía no
  // completaron una medición) - a diferencia de clearAll(), no toca las
  // mediciones ya terminadas. Pensado para cuando se cierra la herramienta
  // con una medición a medio hacer (ej. un solo punto de distancia
  // clickeado, o un área con 4 vértices sin cerrar).
  cancelCurrent(): void {
    this.resetCurrentPoints();
  }

  clearAll(): void {
    for (const measurement of [...this.measurements]) {
      this.clearMeasurement(measurement.id);
    }
    this.resetCurrentPoints();
  }

  private resetCurrentPoints(): void {
    const stale = this.measurementGroup.children.filter(
      (child) => child.userData.isAreaPreviewLine || child.userData.isCurrentPreview,
    );
    for (const child of stale) {
      this.measurementGroup.remove(child);
      this.disposeObject(child);
    }
    this.currentPoints = [];
    this.onCurrentPointsChanged?.(0);
    this.updateHoverPosition(null);
  }

  private disposeObject(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry?.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    }
  }

  onMeasurementCompleted(callback: (m: Measurement) => void): void {
    this.onMeasurementAdded = callback;
  }

  onCurrentPointsCountChanged(callback: (count: number) => void): void {
    this.onCurrentPointsChanged = callback;
  }

  // El detector de snap (SnapDetector) vive afuera de esta clase - acá solo
  // se guarda el resultado y se dibuja. Mantiene a MeasurementManager
  // agnóstico de cómo se obtiene el punto (igual que addPoint ya es
  // agnóstico de si el THREE.Vector3 vino de un raycast normal o de un
  // snap), y evita que esta clase necesite conocer cámara/dom/modelos.
  updateSnap(snap: SnapPoint | null): void {
    this.currentSnap = snap;
    this.visualizeSnap(snap);
  }

  getSnapPoint(): SnapPoint | null {
    return this.currentSnap;
  }

  // Línea "rubber band" desde el último punto colocado hasta la posición
  // actual del cursor (snapeada o no) - sin esto, el snap se ve pero no hay
  // forma de anticipar dónde va a caer el segmento/borde antes de clickear.
  // No toca visualizeCurrentAreaPreview (el cierre del polígono con los
  // puntos YA colocados): es una línea aparte, punteada, para distinguirla
  // a simple vista de las mediciones/preview reales.
  updateHoverPosition(worldPosition: THREE.Vector3 | null): void {
    if (this.hoverPreviewLine) {
      this.measurementGroup.remove(this.hoverPreviewLine);
      this.disposeObject(this.hoverPreviewLine);
      this.hoverPreviewLine = null;
    }
    if (!worldPosition || this.currentPoints.length === 0) return;

    const lastPoint = this.currentPoints[this.currentPoints.length - 1];
    const color = this.currentMode === "distance" ? DISTANCE_COLOR : AREA_PREVIEW_COLOR;
    const geometry = new THREE.BufferGeometry().setFromPoints([lastPoint, worldPosition]);
    const material = new THREE.LineDashedMaterial({ color, dashSize: 0.1, gapSize: 0.05, depthTest: false });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.renderOrder = 999;
    this.measurementGroup.add(line);
    this.hoverPreviewLine = line;
  }

  private visualizeSnap(snap: SnapPoint | null): void {
    if (this.snapVisual) {
      this.measurementGroup.remove(this.snapVisual);
      this.disposeObject(this.snapVisual);
      this.snapVisual = null;
    }
    if (!snap) return;

    if (snap.type === "vertex") {
      this.snapVisual = this.buildVertexSnapVisual(snap);
    } else if (snap.type === "edge") {
      this.snapVisual = this.buildEdgeSnapVisual(snap);
    } else {
      this.snapVisual = this.buildPlaneSnapVisual(snap);
    }

    if (this.snapVisual) {
      this.snapVisual.userData.isSnapPreview = true;
      this.measurementGroup.add(this.snapVisual);
    }
  }

  // Círculo rojo relleno (mismo patrón que addPointMarker) - una esfera se
  // ve como un círculo sólido desde cualquier ángulo de cámara, a
  // diferencia de un anillo plano en un eje fijo, que se vería como una
  // línea de canto en ciertas vistas.
  private buildVertexSnapVisual(snap: SnapPoint): THREE.Object3D {
    const geometry = new THREE.SphereGeometry(SNAP_VERTEX_RADIUS, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: SNAP_COLOR, depthTest: false });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(snap.position);
    marker.renderOrder = 1000;
    return marker;
  }

  // snappedEdgeP1/P2 son los extremos REALES de la arista detectada (los
  // devuelve model.raycastWithSnapping ya resueltos) - no hay que adivinar
  // una línea arbitraria alrededor del punto.
  private buildEdgeSnapVisual(snap: SnapPoint): THREE.Object3D | null {
    if (!snap.edgeStart || !snap.edgeEnd) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints([snap.edgeStart, snap.edgeEnd]);
    const material = new THREE.LineBasicMaterial({ color: SNAP_COLOR, linewidth: 3, depthTest: false });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 1000;
    return line;
  }

  // Cuadrado orientado según la normal real de la cara (no plano en XY fijo,
  // que se vería mal en cualquier cara que no sea horizontal) - se arma en
  // un plano local XY y se rota con la normal detectada.
  private buildPlaneSnapVisual(snap: SnapPoint): THREE.Object3D {
    const half = SNAP_PLANE_SIZE / 2;
    const localPoints = [
      new THREE.Vector3(-half, -half, 0),
      new THREE.Vector3(half, -half, 0),
      new THREE.Vector3(half, half, 0),
      new THREE.Vector3(-half, half, 0),
      new THREE.Vector3(-half, -half, 0),
    ];

    const normal = snap.normal ?? new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const worldPoints = localPoints.map((p) => p.clone().applyQuaternion(quaternion).add(snap.position));

    const geometry = new THREE.BufferGeometry().setFromPoints(worldPoints);
    const material = new THREE.LineBasicMaterial({ color: SNAP_COLOR, linewidth: 2, depthTest: false });
    const square = new THREE.Line(geometry, material);
    square.renderOrder = 1000;
    return square;
  }

  dispose(): void {
    this.clearAll();
    this.visualizeSnap(null);
    this.scene.remove(this.measurementGroup);
  }
}
