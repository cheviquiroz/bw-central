// src/viewer/bcf/BcfPinRenderer.ts
import * as THREE from "three";
import type { BcfStatus, BcfTopic } from "./types/bcf";

const PIN_RADIUS = 0.3;
const STATUS_COLOR: Record<BcfStatus, number> = {
  Open: 0xff4444,
  "Pending Review": 0xffb400,
  Resolved: 0x44ff44,
};
const HIGHLIGHT_COLOR = 0x4a90d9;

// CameraViewPoint (BcfViewpoint.camera.position) es dónde estaba PARADA la
// cámara cuando se sacó la captura del BCF - no el elemento del defecto en
// sí. Poner el pin ahí directo lo dejaría flotando donde el revisor tenía
// el ojo, no sobre lo que estaba mirando (podría caer lejos del modelo, o
// incluso afuera del edificio). Se proyecta en cambio a lo largo de
// CameraDirection una distancia fija - el mismo valor y mismo criterio que
// usa Viewport.tsx para calcular el target de setLookAt() al sincronizar la
// cámara, así el pin queda exactamente en el punto al que la cámara
// termina apuntando cuando se hace click en el topic.
export const PIN_VIEW_DISTANCE = 10;

export class BcfPinRenderer {
  private pins = new Map<string, THREE.Mesh>();
  private scene: THREE.Object3D;

  constructor(scene: THREE.Object3D) {
    this.scene = scene;
  }

  renderPins(topics: BcfTopic[], activeTopicGuid?: string | null): void {
    this.clearPins();

    topics.forEach((topic) => {
      const pin = this.createPin(topic, topic.guid === activeTopicGuid);
      this.pins.set(topic.guid, pin);
      this.scene.add(pin);
    });
  }

  private createPin(topic: BcfTopic, isActive: boolean): THREE.Mesh {
    const color = STATUS_COLOR[topic.status];
    const geometry = new THREE.SphereGeometry(PIN_RADIUS, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: isActive ? HIGHLIGHT_COLOR : 0x000000,
      emissiveIntensity: isActive ? 0.8 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const { position, direction } = topic.viewpoint.camera;
    mesh.position.set(
      position.x + direction.x * PIN_VIEW_DISTANCE,
      position.y + direction.y * PIN_VIEW_DISTANCE,
      position.z + direction.z * PIN_VIEW_DISTANCE,
    );

    mesh.userData = {
      isBcfPin: true,
      topicGuid: topic.guid,
      topicTitle: topic.title,
    };

    return mesh;
  }

  clearPins(): void {
    for (const pin of this.pins.values()) {
      this.scene.remove(pin);
      pin.geometry.dispose();
      (pin.material as THREE.Material).dispose();
    }
    this.pins.clear();
  }

  getPin(topicGuid: string): THREE.Mesh | undefined {
    return this.pins.get(topicGuid);
  }

  dispose(): void {
    this.clearPins();
  }
}
