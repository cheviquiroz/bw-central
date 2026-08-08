// src/viewer/bcf/BcfManager.ts
import { BcfExporter } from "./BcfExporter";
import { BcfImporter } from "./BcfImporter";
import type { BcfFilterStatus, BcfManagerState, BcfPriority, BcfTopic, BcfViewpoint } from "./types/bcf";

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
    isNewProject: false,
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
    // isNewProject: false, explicit - a real imported file is never "sin
    // guardar", even if addTopic() had already synthesized an empty one
    // earlier in this session (loadBcf replacing state.project wholesale
    // is exactly why this needs to be set here, not just left at
    // whatever it happened to be before).
    this.state = { ...this.state, project, topics: project.topics, activeTopic: null, isNewProject: false };
    this.notify();
  }

  async exportBcf(): Promise<Blob> {
    if (!this.state.project) throw new Error("No hay ningún proyecto BCF cargado.");
    return BcfExporter.create(this.state.project);
  }

  /**
   * Creates a new BcfTopic and adds it to the current project, lazily
   * synthesizing an empty BcfProject first if none has been loaded yet
   * this session (Opción A, per this task's locked decision) - a user
   * can create a topic without ever having imported a .bcf file.
   *
   * viewpoint is a required parameter, not captured internally - this
   * class has no Three.js/viewer dependency anywhere else (setFilter/
   * setActiveTopic are pure data operations) and giving it one just for
   * this method would be a real architectural regression; the caller
   * (which has real access to the live viewer) captures it via
   * captureViewpoint.ts's captureCurrentViewpoint() and passes the
   * result in. See that file's own header comment for why the Y-up ->
   * Z-up transform must NOT happen here either - BcfExporter.adaptViewpoint
   * (Punto 1c) is the one place that already happens, for every
   * viewpoint regardless of origin.
   */
  addTopic(title: string, description: string | undefined, priority: BcfPriority | undefined, viewpoint: BcfViewpoint): BcfTopic {
    let project = this.state.project;
    let isNewProject = this.state.isNewProject;
    if (!project) {
      project = { guid: crypto.randomUUID(), name: "Nuevo BCF", topics: [], version: "2.1" };
      isNewProject = true;
    }

    const newTopic: BcfTopic = {
      guid: crypto.randomUUID(),
      title,
      description: description ?? "",
      // No hay concepto de usuario autenticado en esta app (sin auth) -
      // "Usuario" es el mismo tipo de placeholder que BcfImporter.adaptTopic
      // ya usa para datos importados sin autor ("Unknown"), no un dato
      // inventado que finja saber quién es.
      createdAuthor: "Usuario",
      createdDate: new Date().toISOString(),
      priority: priority ?? "Medium",
      status: "Open",
      viewpoints: [viewpoint],
      comments: [],
    };

    const topics = [...project.topics, newTopic];
    project = { ...project, topics };

    this.state = { ...this.state, project, topics, activeTopic: newTopic, isNewProject };
    this.notify();
    return newTopic;
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
