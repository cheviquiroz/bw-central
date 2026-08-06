// src/viewer/SearchManager.ts
import * as THREE from "three";
import * as OBF from "@thatopen/components-front";
import { extractPsetValues } from "@bw-central/ifc-core";
import type { IfcViewerHandles } from "../core/IfcBootstrap";
import type { ApplicationInstance } from "../engine/createApplication";

const HOVER_STYLE = "search-hover";
const MAX_RESULTS = 50;
const HISTORY_KEY = "bwise-search-history";
const FAVORITES_KEY = "bwise-search-favorites";
const HISTORY_MAX = 20;

interface SearchIndexEntry {
  modelId: string;
  localId: number;
  name: string;
  category: string;
  // psetName -> { propName -> valor legible }. Misma heurística "termina
  // en Value" que ya usa PropertiesPanel.tsx para no listar cada tipo de
  // propiedad IFC a mano (NominalValue, LengthValue, AreaValue, etc).
  psets: Record<string, Record<string, string>>;
}

export interface SearchResult {
  modelId: string;
  localId: number;
  name: string;
  category: string;
}

type PropertyOperator = "contains" | "equals" | "gt" | "lt" | "gte" | "lte";

interface TextCondition {
  type: "text";
  value: string;
}

interface PropertyCondition {
  type: "property";
  field: string;
  operator: PropertyOperator;
  value: string;
}

type Condition = TextCondition | PropertyCondition;

/**
 * Indexa TODOS los elementos de los modelos cargados (nombre, categoría,
 * Psets) al cargar/descargar un modelo, y busca en memoria contra ese
 * índice - no hay una query "traeme todo" en la librería, así que se arma
 * una vez reusando el mismo patrón que ya usa SpatialTreeManager.ts para
 * recorrer getSpatialStructure() y pedir getItemsData() de todos los
 * localIds encontrados, solo que acá además se piden los Psets
 * (relations: IsDefinedBy) para poder buscar por propiedad.
 */
export class SearchManager {
  private viewer: IfcViewerHandles;
  private app: ApplicationInstance;
  private index: SearchIndexEntry[] = [];
  private categories: string[] = [];
  private indexReady: Promise<void>;

  constructor(viewer: IfcViewerHandles, app: ApplicationInstance) {
    this.viewer = viewer;
    this.app = app;

    const highlighter = viewer.components.get(OBF.Highlighter);
    if (!highlighter.styles.has(HOVER_STYLE)) {
      highlighter.styles.set(HOVER_STYLE, {
        color: new THREE.Color("#f6d32d"), // amarillo, distinto del azul de selección normal
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      });
    }

    this.indexReady = this.buildIndex();

    viewer.fragments.core.onModelLoaded.add(() => {
      this.indexReady = this.buildIndex();
    });
    app.subscribeToModelUnloaded(() => {
      this.indexReady = this.buildIndex();
    });
  }

  private async buildIndex(): Promise<void> {
    const { fragments } = this.viewer;
    const models = [...(fragments.list.values() as any)];

    // Un modelo por vez sería secuencial (5 edificios federados = 5 fetches
    // completos en fila) - cada modelo es independiente, así que se indexan
    // todos en paralelo y se juntan los resultados al final.
    const perModelEntries = await Promise.all(
      models.map((model: any) => this.indexModel(model)),
    );

    const entries: SearchIndexEntry[] = [];
    const categorySet = new Set<string>();
    for (const modelEntries of perModelEntries) {
      for (const entry of modelEntries) {
        entries.push(entry);
        if (entry.category) categorySet.add(entry.category);
      }
    }

    this.index = entries;
    this.categories = [...categorySet].sort();
  }

  private async indexModel(model: any): Promise<SearchIndexEntry[]> {
    try {
      const rawTree = await model.getSpatialStructure();

      const allLocalIds: number[] = [];
      const collectIds = (node: any) => {
        if (node.localId !== null) allLocalIds.push(node.localId);
        node.children?.forEach(collectIds);
      };
      collectIds(rawTree);

      if (allLocalIds.length === 0) return [];

      const dataList = await model.getItemsData(allLocalIds, {
        attributesDefault: true,
        relations: { IsDefinedBy: { attributes: true, relations: true } },
      });

      const entries: SearchIndexEntry[] = [];
      for (const data of dataList as any[]) {
        if (!data) continue;

        const localId = data?._localId?.value ?? data?._localId;
        if (localId === undefined || localId === null) continue;

        const name = data?.Name?.value || data?.Name || "";
        const category = data?._category?.value || data?._category || "";
        const psets = extractPsetValues(data);

        entries.push({ modelId: model.modelId, localId, name, category, psets });
      }
      return entries;
    } catch (error) {
      console.error("❌ Error indexando modelo para búsqueda:", error);
      return [];
    }
  }

  async getCategories(): Promise<string[]> {
    await this.indexReady;
    return this.categories;
  }

  /**
   * Tokeniza por espacios. Cada token con operador (":", "=", ">", "<",
   * ">=", "<=") es una condición de propiedad; el resto son texto libre.
   * Texto libre: OR entre sí. Propiedades: AND entre sí (y AND contra el
   * bloque de texto libre, si hay). Ej: "wall material:vidrio" =
   * (nombre~wall OR categoría~wall) AND material~vidrio.
   *
   * NO soportado (deliberado, fuera de alcance de esta pasada): AND/OR
   * literales escritos por el usuario, paréntesis, negación. Si hace
   * falta esa expresividad, es el caso de uso real para el query builder
   * (Nivel 3), no para la sintaxis de texto libre.
   */
  private parseQuery(raw: string): Condition[] {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    const conditions: Condition[] = [];

    // Orden importa: ">=" y "<=" tienen que probarse antes que ">"/"<"/"=",
    // si no un token "level>=3" se partiría mal en el primer operador que
    // matchee de izquierda a derecha.
    const operatorPattern = /^([^:><=]+)(>=|<=|:|>|<|=)(.+)$/;

    for (const token of tokens) {
      const match = token.match(operatorPattern);
      if (match) {
        const [, field, opRaw, value] = match;
        const operator: PropertyOperator =
          opRaw === ">=" ? "gte" :
          opRaw === "<=" ? "lte" :
          opRaw === ">" ? "gt" :
          opRaw === "<" ? "lt" :
          opRaw === "=" ? "equals" : "contains"; // ":"

        conditions.push({
          type: "property",
          field: field.toLowerCase(),
          operator,
          value: value.toLowerCase().replace(/\*/g, ""), // "*" no es wildcard real, ya es substring
        });
      } else {
        conditions.push({ type: "text", value: token.toLowerCase() });
      }
    }

    return conditions;
  }

  async search(query: string, typeFilters: Set<string> = new Set()): Promise<SearchResult[]> {
    await this.indexReady;

    const trimmed = query.trim();
    if (!trimmed) return [];
    this.pushHistory(trimmed);

    const conditions = this.parseQuery(trimmed);
    const results: SearchResult[] = [];

    for (const entry of this.index) {
      if (typeFilters.size > 0 && !typeFilters.has(entry.category)) continue;
      if (!this.matchesConditions(entry, conditions)) continue;

      results.push({
        modelId: entry.modelId,
        localId: entry.localId,
        name: entry.name || `Elemento #${entry.localId}`,
        category: entry.category,
      });
      if (results.length >= MAX_RESULTS) break;
    }

    return results;
  }

  private matchesConditions(entry: SearchIndexEntry, conditions: Condition[]): boolean {
    const textConditions = conditions.filter((c): c is TextCondition => c.type === "text");
    const propertyConditions = conditions.filter((c): c is PropertyCondition => c.type === "property");

    if (textConditions.length > 0) {
      const anyTextMatches = textConditions.some(
        (c) => entry.name.toLowerCase().includes(c.value) || entry.category.toLowerCase().includes(c.value),
      );
      if (!anyTextMatches) return false;
    }

    for (const condition of propertyConditions) {
      if (!this.matchesPropertyCondition(entry, condition)) return false;
    }

    return true;
  }

  private matchesPropertyCondition(entry: SearchIndexEntry, condition: PropertyCondition): boolean {
    for (const props of Object.values(entry.psets)) {
      for (const [propName, propValue] of Object.entries(props)) {
        if (!propName.toLowerCase().includes(condition.field)) continue;

        const value = propValue.toLowerCase();

        switch (condition.operator) {
          case "contains":
            if (value.includes(condition.value)) return true;
            break;
          case "equals":
            if (value === condition.value) return true;
            break;
          case "gt": case "lt": case "gte": case "lte": {
            const numProp = parseFloat(propValue);
            const numQuery = parseFloat(condition.value);
            if (Number.isNaN(numProp) || Number.isNaN(numQuery)) break;
            if (condition.operator === "gt" && numProp > numQuery) return true;
            if (condition.operator === "lt" && numProp < numQuery) return true;
            if (condition.operator === "gte" && numProp >= numQuery) return true;
            if (condition.operator === "lte" && numProp <= numQuery) return true;
            break;
          }
        }
      }
    }
    return false;
  }

  highlightResult(modelId: string, localId: number): void {
    const highlighter = this.viewer.components.get(OBF.Highlighter);
    highlighter.highlightByID(HOVER_STYLE, { [modelId]: new Set([localId]) }, true, false);
  }

  clearHover(): void {
    const highlighter = this.viewer.components.get(OBF.Highlighter);
    highlighter.clear(HOVER_STYLE);
  }

  // Resalta TODOS los resultados a la vez, en azul - el mismo estilo "select"
  // que usa la selección normal (SelectionManager.ts ya escucha ese canal y
  // publica los elementos en PropertiesPanel, así que buscar "IfcWall" deja
  // el panel mostrando "N elementos seleccionados" gratis, sin plumbing
  // nuevo). removePrevious:true reemplaza cualquier resaltado de búsqueda
  // anterior; un click manual en el visor mientras hay resultados
  // resaltados los reemplaza a su vez de la misma forma (mismo canal).
  highlightAllResults(results: SearchResult[]): void {
    const highlighter = this.viewer.components.get(OBF.Highlighter);

    if (results.length === 0) {
      highlighter.clear("select");
      return;
    }

    const map: Record<string, Set<number>> = {};
    for (const result of results) {
      if (!map[result.modelId]) map[result.modelId] = new Set();
      map[result.modelId].add(result.localId);
    }

    highlighter.highlightByID("select", map, true, false);
  }

  clearAllResultsHighlight(): void {
    const highlighter = this.viewer.components.get(OBF.Highlighter);
    highlighter.clear("select");
  }

  // onNotFound: optional, additive - existing callers (the search bar on
  // "/") pass nothing and keep their original silent-no-op behavior on a
  // miss. /revision's findings table (RevisionLayout.tsx) passes a
  // callback so it can log a warning and fall back to fit-all instead of
  // just doing nothing - a search-bar miss and a findings-table miss
  // warrant different UX, so the fallback is caller-supplied, not baked
  // in here.
  async selectAndFocus(modelId: string, localId: number, onNotFound?: () => void): Promise<void> {
    this.app.requestSelectByLocalId(modelId, localId);

    const model = this.viewer.fragments.list.get(modelId) as any;
    if (!model) {
      onNotFound?.();
      return;
    }

    const box = await model.getMergedBox([localId]);
    if (!box || box.isEmpty()) {
      onNotFound?.();
      return;
    }

    (this.viewer.world.camera as any).controls.fitToBox(box, true, {
      paddingLeft: 1, paddingRight: 1, paddingTop: 1, paddingBottom: 1,
    });
  }

  getHistory(): string[] {
    return this.readList(HISTORY_KEY);
  }

  getFavorites(): string[] {
    return this.readList(FAVORITES_KEY);
  }

  toggleFavorite(query: string): void {
    const favorites = this.getFavorites();
    const next = favorites.includes(query)
      ? favorites.filter((q) => q !== query)
      : [query, ...favorites];
    this.writeList(FAVORITES_KEY, next);
  }

  private pushHistory(query: string): void {
    const history = this.getHistory().filter((q) => q !== query);
    history.unshift(query);
    this.writeList(HISTORY_KEY, history.slice(0, HISTORY_MAX));
  }

  private readList(key: string): string[] {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeList(key: string, list: string[]): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // localStorage puede fallar (modo privado, cuota) - no es crítico, se pierde el historial/favoritos nomás
    }
  }
}
