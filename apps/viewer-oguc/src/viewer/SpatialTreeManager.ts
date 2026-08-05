// src/viewer/SpatialTreeManager.ts
import { readIfcName } from "@bw-central/ifc-core";
import type { IfcViewerHandles } from "../core/IfcBootstrap";
import type { ApplicationInstance, ModelTreeNode } from "../engine/createApplication";

/**
 * Construye el árbol de jerarquía espacial IFC (Proyecto > Sitio > Edificio >
 * Piso > Elemento) cada vez que un modelo termina de cargar de verdad.
 *
 * Usa fragments.core.onModelLoaded en vez de fragments.list.onItemSet, porque
 * onItemSet se dispara antes de que el modelo termine de indexarse en el
 * worker (confirmado en el código fuente de @thatopen/fragments).
 */
export class SpatialTreeManager {
  constructor(viewer: IfcViewerHandles, app: ApplicationInstance) {
    const { fragments } = viewer;

    fragments.core.onModelLoaded.add(async (model: any) => {
      try {
        const rawTree = await model.getSpatialStructure();

        const allLocalIds: number[] = [];
        const collectIds = (node: typeof rawTree) => {
          if (node.localId !== null) allLocalIds.push(node.localId);
          node.children?.forEach(collectIds);
        };
        collectIds(rawTree);

        const namesById = new Map<number, string | null>();
        if (allLocalIds.length > 0) {
          const dataList = await model.getItemsData(allLocalIds, {
            attributesDefault: true,
          });
          for (let i = 0; i < allLocalIds.length; i++) {
            namesById.set(allLocalIds[i], readIfcName(dataList[i] as any));
          }
        }

        // Cada nodo recibe un ID de posición único (independiente de si tiene
        // localId real o no), porque los nodos de agrupación IFC (Piso,
        // Categoría) siempre tienen localId: null y solo los elementos hoja
        // tienen un localId real. Sin este ID de posición, es imposible
        // marcar los nodos intermedios como parte del camino a expandir.
        let positionCounter = 0;
        const enrich = (node: typeof rawTree): ModelTreeNode => {
          const treeNodeId = positionCounter++;
          return {
            treeNodeId,
            category: node.category,
            localId: node.localId,
            name: node.localId !== null ? namesById.get(node.localId) ?? null : null,
            children: node.children?.map(enrich),
          };
        };

        const enrichedTree = enrich(rawTree);
        app.setModelTree(model.modelId, enrichedTree);
      } catch (error) {
        console.error("❌ Error construyendo el árbol espacial del modelo:", error);
      }
    });
  }
}
