// src/viewer/bcf/BcfManager.ts
import { BcfExporter } from "./BcfExporter";
import { BcfImporter } from "./BcfImporter";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "./types/bcf";

// La primera versión de este manager mutaba un objeto de estado privado
// directo (this.state.x = y) sin ningún mecanismo de notificación - nunca
// iba a disparar un re-render de React, aunque los datos internos sí
// cambiaran. Acá se usa el mismo patrón pub/sub ya probado en
// ApplicationInstance (createApplication.ts): un Set<listener>, un
// notify() que dispara una snapshot inmutable, y cada setter llama a
// notify() después de actualizar el estado.
export class BcfManager {
  private state: BcfManagerState = {
    project: null,
    topics: [],
    activeTopic: null,
    filters: { status: "All" },
  };
  private listeners = new Set<(state: BcfManagerState) => void>();

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  subscribe(listener: (state: BcfManagerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async loadBcf(file: File): Promise<void> {
    const project = await BcfImporter.parse(file);
    this.state = { ...this.state, project, topics: project.topics, activeTopic: null };
    this.notify();
  }

  async exportBcf(): Promise<Blob> {
    if (!this.state.project) throw new Error("No hay ningún proyecto BCF cargado.");
    return BcfExporter.create(this.state.project);
  }

  setActiveTopic(topic: BcfTopic | null): void {
    this.state = { ...this.state, activeTopic: topic };
    this.notify();
  }

  setFilter(status: BcfFilterStatus): void {
    this.state = { ...this.state, filters: { status } };
    this.notify();
  }

  getState(): Readonly<BcfManagerState> {
    return { ...this.state, filters: { ...this.state.filters } };
  }
}
