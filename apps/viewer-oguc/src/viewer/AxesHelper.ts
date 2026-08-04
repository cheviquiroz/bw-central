// src/viewer/AxesHelper.ts
import * as THREE from "three";

export class AxesHelper {
  private scene: THREE.Object3D;
  private size: number;
  private axes: THREE.Group | null = null;
  private isVisible = false;

  constructor(scene: THREE.Object3D, size: number = 10) {
    this.scene = scene;
    this.size = size;
  }

  create(): THREE.Group {
    if (this.axes) return this.axes;

    this.axes = new THREE.Group();

    this.axes.add(this.createAxis([0, 0, 0], [this.size, 0, 0], 0xff0000)); // X
    this.axes.add(this.createAxis([0, 0, 0], [0, this.size, 0], 0x00ff00)); // Y
    this.axes.add(this.createAxis([0, 0, 0], [0, 0, -this.size], 0x0000ff)); // Z

    this.axes.visible = this.isVisible;
    this.scene.add(this.axes);
    return this.axes;
  }

  private createAxis(from: number[], to: number[], color: number): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from[0], from[1], from[2]),
      new THREE.Vector3(to[0], to[1], to[2]),
    ]);
    // linewidth solo tiene efecto real en drivers que soportan líneas
    // gruesas vía WebGL (la mayoría de los navegadores/GPUs lo ignoran y
    // renderizan 1px, limitación conocida de LineBasicMaterial) - se deja
    // igual porque no hace daño, pero no esperar líneas gruesas de verdad.
    const material = new THREE.LineBasicMaterial({ color, linewidth: 3 });
    return new THREE.Line(geometry, material);
  }

  toggle(visible?: boolean): void {
    if (!this.axes) this.create();
    this.isVisible = visible !== undefined ? visible : !this.isVisible;
    this.axes!.visible = this.isVisible;
  }

  isShown(): boolean {
    return this.isVisible;
  }

  dispose(): void {
    if (!this.axes) return;

    this.scene.remove(this.axes);
    this.axes.traverse((child) => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.LineBasicMaterial).dispose();
      }
    });
    this.axes = null;
  }
}
