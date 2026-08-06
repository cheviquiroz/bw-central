// src/engine/createApplication.ts
import { IfcLoaderAdapter } from "./adapters/ThatOpenModelLoaderAdapter";
import { InMemoryFederationRepository } from "./adapters/InMemoryFederationRepository";
import { registerModel } from "./application/registerModel";
import { removeModelFromFederation } from "@bw-central/ifc-core";
import type { FederationId, ModelId, ProximityWarning } from "@bw-central/ifc-core";

export interface ModelProgress {
  percentage: number;
  statusMessage: string;
}

export type RegisterModelResult =
  // modelId is the same key modelDisplayNames/getModelTrees() use for
  // this model - added so callers can correlate a freshly-imported
  // model with a side-channel keyed the same way (see
  // core/ModelBytesRegistry.ts, which retains raw import bytes for the
  // /revision Pre-Check gate to re-read via ifc-headless).
  | { success: true; value: { name: string }; modelId: string }
  | { success: false; error: string };

export type SelectionState = Record<string, string[]>;

export interface SelectedElement {
  guid: string;
  localId: number;
  data: any;
}

export interface ModelTreeNode {
  treeNodeId: number;
  category: string | null;
  localId: number | null;
  name: string | null;
  children?: ModelTreeNode[];
}

export type ModelTrees = Record<string, ModelTreeNode>;

export type ModelDisplayNames = Record<string, string>;

export interface ApplicationInstance {
  importNewModel(
    name: string,
    content: Uint8Array,
    onProgress?: (progress: ModelProgress) => void
  ): Promise<RegisterModelResult>;

  setSelection(elementsByModel: Record<string, SelectedElement[]>): void;
  clearSelection(): void;
  getSelection(): SelectionState;
  getSelectedElementsData(): SelectedElement[];
  subscribeToSelection(listener: (selection: SelectionState) => void): () => void;

  setModelTree(modelId: string, tree: ModelTreeNode): void;
  getModelTrees(): ModelTrees;
  subscribeToModelTrees(listener: (trees: ModelTrees) => void): () => void;

  requestSelectByLocalId(modelId: string, localId: number): void;
  subscribeToSelectionRequests(listener: (modelId: string, localId: number) => void): () => void;

  requestSearchQuery(query: string): void;
  subscribeToSearchQueryRequests(listener: (query: string) => void): () => void;

  setModelVisibility(modelId: string, visible: boolean): Promise<void>;
  setElementVisibility(modelId: string, localId: number, visible: boolean): Promise<void>;
  unloadModel(modelId: string): Promise<void>;

  getModelDisplayNames(): ModelDisplayNames;
  subscribeToModelDisplayNames(listener: (names: ModelDisplayNames) => void): () => void;

  setProximityWarnings(warnings: ProximityWarning[]): void;
  getProximityWarnings(): ProximityWarning[];
  subscribeToProximityWarnings(listener: (warnings: ProximityWarning[]) => void): () => void;

  subscribeToModelUnloaded(listener: (modelId: string) => void): () => void;
}

export function createApplication(): ApplicationInstance {
  const ifcLoaderAdapter = new IfcLoaderAdapter();
  const federationRepository = new InMemoryFederationRepository();

  const defaultFederationId = "default-federation" as FederationId;
  federationRepository.seed({ id: defaultFederationId, models: [] });

  let currentSelection: SelectionState = {};
  let currentElementsData: SelectedElement[] = [];
  const selectionListeners = new Set<(selection: SelectionState) => void>();

  const notifySelectionChanged = () => {
    selectionListeners.forEach((listener) => listener({ ...currentSelection }));
  };

  let currentModelTrees: ModelTrees = {};
  const modelTreeListeners = new Set<(trees: ModelTrees) => void>();

  const notifyModelTreesChanged = () => {
    modelTreeListeners.forEach((listener) => listener({ ...currentModelTrees }));
  };

  let currentModelDisplayNames: ModelDisplayNames = {};
  const modelDisplayNameListeners = new Set<(names: ModelDisplayNames) => void>();

  const notifyModelDisplayNamesChanged = () => {
    modelDisplayNameListeners.forEach((listener) => listener({ ...currentModelDisplayNames }));
  };

  const selectionRequestListeners = new Set<(modelId: string, localId: number) => void>();
  const modelUnloadedListeners = new Set<(modelId: string) => void>();
  const searchQueryRequestListeners = new Set<(query: string) => void>();

  let currentProximityWarnings: ProximityWarning[] = [];
  const proximityWarningListeners = new Set<(warnings: ProximityWarning[]) => void>();

  const notifyProximityWarningsChanged = () => {
    proximityWarningListeners.forEach((listener) => listener([...currentProximityWarnings]));
  };

  // Puente interno: el visor 3D identifica modelos por un ID técnico (el que
  // asigna That Open Components), pero la Federación los identifica por su
  // ModelId de dominio (hash de contenido). Este mapa conecta ambos mundos,
  // necesario para poder quitar un modelo de la Federación al eliminarlo.
  const technicalToDomainModelId = new Map<string, ModelId>();

  const clearSelectionForModel = (modelId: string) => {
    if (!currentSelection[modelId]) return;

    const newSelection = { ...currentSelection };
    delete newSelection[modelId];

    const newElementsData = currentElementsData.filter((el) => {
      const guidsOfModel = currentSelection[modelId] || [];
      return !guidsOfModel.includes(el.guid);
    });

    currentSelection = newSelection;
    currentElementsData = newElementsData;
    notifySelectionChanged();
  };

  return {
    importNewModel: async (name, content, onProgress) => {
      const result = await registerModel(
        { name, content, federationId: defaultFederationId },
        ifcLoaderAdapter,
        federationRepository,
        onProgress
      );

      if (result.success) {
        currentModelDisplayNames = {
          ...currentModelDisplayNames,
          [result.technicalModelId]: result.value.name,
        };
        notifyModelDisplayNamesChanged();

        technicalToDomainModelId.set(result.technicalModelId, result.value.id);

        return { success: true, value: { name: result.value.name }, modelId: result.technicalModelId };
      }

      return result;
    },

    setSelection: (elementsByModel) => {
      const newSelection: SelectionState = {};
      const newElementsData: SelectedElement[] = [];

      for (const [modelId, elements] of Object.entries(elementsByModel)) {
        newSelection[modelId] = elements.map((e) => e.guid);
        newElementsData.push(...elements);
      }

      currentSelection = newSelection;
      currentElementsData = newElementsData;
      notifySelectionChanged();
    },

    clearSelection: () => {
      currentSelection = {};
      currentElementsData = [];
      notifySelectionChanged();
    },

    getSelection: () => ({ ...currentSelection }),

    getSelectedElementsData: () => [...currentElementsData],

    subscribeToSelection: (listener) => {
      selectionListeners.add(listener);
      return () => {
        selectionListeners.delete(listener);
      };
    },

    setModelTree: (modelId, tree) => {
      currentModelTrees = { ...currentModelTrees, [modelId]: tree };
      notifyModelTreesChanged();
    },

    getModelTrees: () => ({ ...currentModelTrees }),

    subscribeToModelTrees: (listener) => {
      modelTreeListeners.add(listener);
      return () => {
        modelTreeListeners.delete(listener);
      };
    },

    requestSelectByLocalId: (modelId, localId) => {
      selectionRequestListeners.forEach((listener) => listener(modelId, localId));
    },

    subscribeToSelectionRequests: (listener) => {
      selectionRequestListeners.add(listener);
      return () => {
        selectionRequestListeners.delete(listener);
      };
    },

    // Canal genérico para "click-to-filter": PropertiesPanel (Shift+click en
    // una propiedad) y SelectionManager (Shift+click en un elemento del 3D)
    // arman el string de query ("material:acero", "type:IFCWALL") y lo
    // publican acá, sin conocer a SearchBar directamente - mismo patrón que
    // requestSelectByLocalId/subscribeToSelectionRequests de arriba.
    requestSearchQuery: (query) => {
      searchQueryRequestListeners.forEach((listener) => listener(query));
    },

    subscribeToSearchQueryRequests: (listener) => {
      searchQueryRequestListeners.add(listener);
      return () => {
        searchQueryRequestListeners.delete(listener);
      };
    },

    setModelVisibility: async (modelId, visible) => {
      await ifcLoaderAdapter.setModelVisibility(modelId, visible);
      if (!visible) {
        clearSelectionForModel(modelId);
      }
    },

    setElementVisibility: async (modelId, localId, visible) => {
      await ifcLoaderAdapter.setElementVisibility(modelId, localId, visible);
    },

    unloadModel: async (modelId) => {
      await ifcLoaderAdapter.unloadModel(modelId);

      modelUnloadedListeners.forEach((listener) => listener(modelId));

      clearSelectionForModel(modelId);

      if (currentModelTrees[modelId]) {
        const newTrees = { ...currentModelTrees };
        delete newTrees[modelId];
        currentModelTrees = newTrees;
        notifyModelTreesChanged();
      }

      if (currentModelDisplayNames[modelId]) {
        const newNames = { ...currentModelDisplayNames };
        delete newNames[modelId];
        currentModelDisplayNames = newNames;
        notifyModelDisplayNamesChanged();
      }

      // Quitar el modelo de la Federación de verdad, para que su hash de
      // contenido vuelva a estar disponible (no siga marcado como duplicado).
      const domainModelId = technicalToDomainModelId.get(modelId);
      if (domainModelId) {
        const federation = await federationRepository.get(defaultFederationId);
        if (federation) {
          const result = removeModelFromFederation(federation, domainModelId);
          if (result.success) {
            await federationRepository.save(result.value);
          }
        }
        technicalToDomainModelId.delete(modelId);
      }
    },

    getModelDisplayNames: () => ({ ...currentModelDisplayNames }),

    subscribeToModelDisplayNames: (listener) => {
      modelDisplayNameListeners.add(listener);
      return () => {
        modelDisplayNameListeners.delete(listener);
      };
    },

    setProximityWarnings: (warnings) => {
      currentProximityWarnings = warnings;
      notifyProximityWarningsChanged();
    },

    getProximityWarnings: () => [...currentProximityWarnings],

    subscribeToProximityWarnings: (listener) => {
      proximityWarningListeners.add(listener);
      return () => {
        proximityWarningListeners.delete(listener);
      };
    },

    subscribeToModelUnloaded: (listener) => {
      modelUnloadedListeners.add(listener);
      return () => {
        modelUnloadedListeners.delete(listener);
      };
    },
  };
}
