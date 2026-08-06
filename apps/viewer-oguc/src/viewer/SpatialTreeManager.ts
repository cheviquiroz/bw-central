// src/viewer/SpatialTreeManager.ts
import { readIfcName } from "@bw-central/ifc-core";
import type { IfcViewerHandles } from "../core/IfcBootstrap";
import type { ApplicationInstance, ModelTreeNode } from "../engine/createApplication";

/**
 * @thatopen/fragments' getSpatialStructure() represents every real
 * spatial entity (IfcProject/IfcSite/IfcBuilding/IfcBuildingStorey) as
 * TWO tree nodes, not one: a "category wrapper" (category set, localId:
 * null - this is what the UI showed before this fix: "IFCPROJECT",
 * "IFCSITE", ...) whose single child is the actual "entity data" node
 * (category: null, real localId, real name). Confirmed by inspecting the
 * real tree via app.getModelTrees() against EOFF-SPC-IFC-I01.ifc, not
 * assumed - a naive reading of this data (as the previous UI did) shows
 * "IFCPROJECT" then "UPeU" as two separate rows for what is conceptually
 * one entity (the project). This merges that pair into a single node:
 * the real name/localId/children come from the entity-data child, the
 * category comes from the wrapper, so the tree can show the real name as
 * the headline with the IFC class as secondary text (see ModelTree.tsx),
 * matching what the data actually means instead of what the library
 * happens to split it into.
 *
 * Deliberately narrow: only merges when the wrapper has EXACTLY ONE
 * child and that child is itself an entity-data node (category: null).
 * A category wrapper with multiple children (e.g. "IFCSPACE" grouping
 * several real rooms under a storey) is a real, useful grouping heading
 * and must NOT collapse into just one of its children.
 */
function collapseCategoryWrappers(node: ModelTreeNode): ModelTreeNode {
  const children = node.children?.map(collapseCategoryWrappers);
  const isCategoryWrapper = node.category !== null && node.localId === null;
  const onlyChild = children?.length === 1 ? children[0] : null;
  const onlyChildIsEntityData = onlyChild !== null && onlyChild.category === null;

  if (isCategoryWrapper && onlyChildIsEntityData) {
    return { ...onlyChild, treeNodeId: node.treeNodeId, category: node.category };
  }
  return { ...node, children };
}

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

        const enrichedTree = collapseCategoryWrappers(enrich(rawTree));
        app.setModelTree(model.modelId, enrichedTree);
      } catch (error) {
        console.error("❌ Error construyendo el árbol espacial del modelo:", error);
      }
    });
  }
}
