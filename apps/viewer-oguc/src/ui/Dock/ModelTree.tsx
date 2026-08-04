// src/ui/Dock/ModelTree.tsx
import { useEffect, useState, useMemo } from "react";
import { useApp } from "../AppContext";
import type { ModelTrees, ModelTreeNode, ApplicationInstance, SelectionState, ModelDisplayNames } from "../../engine/createApplication";
import type { ProximityWarning } from "@bw-central/ifc-core";
import { IconChevron, IconFolder, IconEye, IconTrash } from "../icons/dock";

function findPathToLocalId(node: ModelTreeNode, targetLocalId: number): number[] | null {
  if (node.localId === targetLocalId) {
    return [node.treeNodeId];
  }
  if (!node.children) return null;

  for (const child of node.children) {
    const path = findPathToLocalId(child, targetLocalId);
    if (path) {
      return [node.treeNodeId, ...path];
    }
  }
  return null;
}

// Solo tiene sentido en nodos de agrupación (Piso, categoría) - un nodo
// hoja ya ES el elemento, no hace falta contarlo.
function countLeaves(node: ModelTreeNode): number {
  if (!node.children || node.children.length === 0) {
    return node.localId !== null ? 1 : 0;
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function TreeNode({
  node,
  depth,
  modelId,
  app,
  expandedIds,
  selectedLocalId,
  hiddenLocalIds,
  onToggleVisibility,
}: {
  node: ModelTreeNode;
  depth: number;
  modelId: string;
  app: ApplicationInstance;
  expandedIds: Set<number>;
  selectedLocalId: number | null;
  hiddenLocalIds: Set<number>;
  onToggleVisibility: (localId: number) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isSelectable = !hasChildren && node.localId !== null;
  const isSelected = node.localId !== null && node.localId === selectedLocalId;
  const isHidden = node.localId !== null && hiddenLocalIds.has(node.localId);

  const [manuallyExpanded, setManuallyExpanded] = useState(depth < 2);
  const autoExpanded = expandedIds.has(node.treeNodeId);
  const expanded = manuallyExpanded || autoExpanded;

  const safeName = typeof node.name === "string" ? node.name : null;
  const safeCategory = typeof node.category === "string" ? node.category : null;
  const label = safeName || safeCategory || `Elemento #${node.localId ?? "?"}`;

  // El badge de cantidad solo se calcula para nodos de agrupación - contar
  // hojas recursivas en cada render es aceptable acá (árboles de cientos,
  // no cientos de miles de nodos visibles a la vez gracias al collapse),
  // pero si un modelo federado gigante se sintiera lento, memoizar esto
  // por nodo sería el primer lugar donde mirar.
  const leafCount = hasChildren ? countLeaves(node) : 0;

  const handleClick = () => {
    if (hasChildren) {
      setManuallyExpanded((v) => !v);
    } else if (isSelectable) {
      app.requestSelectByLocalId(modelId, node.localId as number);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`dock-tree-node${expanded ? " open" : ""}${isSelected ? " selected" : ""}`}
        style={{ paddingLeft: `${18 + depth * 12}px` }}
      >
        {hasChildren ? (
          <span className="chev"><IconChevron /></span>
        ) : (
          <span style={{ width: "12px", flexShrink: 0 }} />
        )}
        {!hasChildren && isSelectable && (
          <span
            className="ico"
            style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor", flexShrink: 0 }}
          />
        )}
        <span className="lbl">{label}</span>
        {hasChildren && leafCount > 0 && <span className="count">{leafCount}</span>}
        {isSelectable && (
          <svg
            className={`dock-tree-eye${isHidden ? " hidden-element" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(node.localId as number);
            }}
          >
            <title>{isHidden ? "Mostrar elemento" : "Ocultar elemento"}</title>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.treeNodeId}
              node={child}
              depth={depth + 1}
              modelId={modelId}
              app={app}
              expandedIds={expandedIds}
              selectedLocalId={selectedLocalId}
              hiddenLocalIds={hiddenLocalIds}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelHeader({ modelId, app, displayNames, proximityWarning }: { modelId: string; app: ApplicationInstance; displayNames: ModelDisplayNames; proximityWarning: ProximityWarning | null }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

  const displayName = displayNames[modelId] || modelId || "Modelo sin nombre";

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isVisible;
    setIsTogglingVisibility(true);
    try {
      await app.setModelVisibility(modelId, next);
      setIsVisible(next);
    } catch (error) {
      console.error("Error al cambiar visibilidad del modelo:", error);
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleUnload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${displayName}" del visor? Esta acción no se puede deshacer.`)) {
      return;
    }
    setIsRemoving(true);
    try {
      await app.unloadModel(modelId);
    } catch (error) {
      console.error("Error al eliminar el modelo:", error);
      setIsRemoving(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px 6px 18px",
        opacity: isRemoving ? 0.4 : 1,
        pointerEvents: isRemoving ? "none" : "auto",
      }}
    >
      <span
        className="ico"
        style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", minWidth: 0, color: "var(--dock-text-hover)", fontWeight: 600, fontSize: "12.5px" }}
      >
        <span style={{ flexShrink: 0, display: "flex" }}><IconFolder /></span>
        {proximityWarning && (
          <span style={{ flexShrink: 0 }} title={`Este modelo está a ${Math.round(proximityWarning.distanceFromGroupMeters)}m del resto de los modelos cargados`}>
            ⚠️
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
      </span>
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        <span
          className="dock-tree-eye"
          style={{ opacity: isTogglingVisibility ? 0.5 : isVisible ? 0 : 1, color: isVisible ? undefined : "var(--dock-selected-border)" }}
          onClick={handleToggleVisibility}
          title={isVisible ? "Ocultar modelo" : "Mostrar modelo"}
        >
          <IconEye />
        </span>
        <span
          className="dock-action"
          style={{ width: "16px", height: "16px", color: "#e07a7a" }}
          onClick={handleUnload}
          title="Eliminar modelo del visor"
        >
          <IconTrash />
        </span>
      </div>
    </div>
  );
}

export function ModelTree() {
  const app = useApp();
  const [trees, setTrees] = useState<ModelTrees>(app.getModelTrees());
  const [selection, setSelectionState] = useState<SelectionState>(app.getSelection());
  const [displayNames, setDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  const [proximityWarnings, setProximityWarnings] = useState<ProximityWarning[]>(app.getProximityWarnings());
  const [hiddenByModel, setHiddenByModel] = useState<Record<string, Set<number>>>({});

  useEffect(() => {
    const unsubscribeTrees = app.subscribeToModelTrees((newTrees) => setTrees(newTrees));
    const unsubscribeSelection = app.subscribeToSelection((newSelection) => setSelectionState(newSelection));
    const unsubscribeNames = app.subscribeToModelDisplayNames((newNames) => setDisplayNames(newNames));
    const unsubscribeWarnings = app.subscribeToProximityWarnings((newWarnings) => setProximityWarnings(newWarnings));
    return () => {
      unsubscribeTrees();
      unsubscribeSelection();
      unsubscribeNames();
      unsubscribeWarnings();
    };
  }, [app]);

  const modelIds = Object.keys(trees);

  const { expandedIdsByModel, selectedLocalIdByModel } = useMemo(() => {
    const expandedIdsByModel: Record<string, Set<number>> = {};
    const selectedLocalIdByModel: Record<string, number | null> = {};

    for (const modelId of modelIds) {
      const guids = selection[modelId] || [];
      expandedIdsByModel[modelId] = new Set();
      selectedLocalIdByModel[modelId] = null;

      if (guids.length === 0) continue;

      const selectedElements = app.getSelectedElementsData();
      const matching = selectedElements.find((el) => guids.includes(el.guid));
      if (!matching) continue;

      const path = findPathToLocalId(trees[modelId], matching.localId);
      if (path) {
        path.forEach((id) => expandedIdsByModel[modelId].add(id));
        selectedLocalIdByModel[modelId] = matching.localId;
      }
    }

    return { expandedIdsByModel, selectedLocalIdByModel };
  }, [selection, trees, modelIds, app]);

  const handleToggleVisibility = (modelId: string, localId: number) => {
    setHiddenByModel((prev) => {
      const current = new Set(prev[modelId] ?? []);
      const nextVisible = current.has(localId); // si ya estaba oculto, esto lo va a mostrar
      if (current.has(localId)) current.delete(localId);
      else current.add(localId);

      app.setElementVisibility(modelId, localId, nextVisible).catch((error) => {
        console.error("❌ Error cambiando visibilidad del elemento:", error);
      });

      return { ...prev, [modelId]: current };
    });
  };

  if (modelIds.length === 0) {
    return (
      <p style={{ fontSize: "12px", color: "var(--dock-text-secondary)", padding: "16px 20px" }}>
        Sin modelos cargados todavía.
      </p>
    );
  }

  return (
    <div>
      {modelIds.map((modelId) => (
        <div key={modelId} style={{ marginBottom: "4px" }}>
          <ModelHeader
            modelId={modelId}
            app={app}
            displayNames={displayNames}
            proximityWarning={proximityWarnings.find((w) => w.modelId === modelId) ?? null}
          />
          <TreeNode
            node={trees[modelId]}
            depth={0}
            modelId={modelId}
            app={app}
            expandedIds={expandedIdsByModel[modelId] || new Set()}
            selectedLocalId={selectedLocalIdByModel[modelId] ?? null}
            hiddenLocalIds={hiddenByModel[modelId] ?? new Set()}
            onToggleVisibility={(localId) => handleToggleVisibility(modelId, localId)}
          />
        </div>
      ))}
    </div>
  );
}
