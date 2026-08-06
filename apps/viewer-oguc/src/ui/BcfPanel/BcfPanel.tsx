// src/ui/BcfPanel/BcfPanel.tsx
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import { usePanelWidth } from "../PanelWidthContext";
import { IconLock } from "../icons/dock";
import { IssueList } from "./IssueList";
import { FilterBar } from "./FilterBar";
import { ToolbarButton } from "../Toolbar/ToolbarButton";
import { getModulesForSurface } from "../registry/modules";
import type { ModuleRuntimeMap } from "../registry/modules";
import "./bcf-panel.css";

// Import/Export ya no viven en la Toolbar (ver Phase 3 del commit que
// mueve BCF al panel): importar un BCF es una acción de workflow que
// produce contenido EN este panel, y el usuario ya está mirándolo cuando
// la necesita - dejarla en la barra superior separaba la acción de su
// resultado. getModulesForSurface("bcf-panel") es la misma fuente única
// de verdad que usa Toolbar.tsx para sus propios módulos, filtrada por
// dónde debe renderizar cada uno.
const BCF_PANEL_MODULES = getModulesForSurface("bcf-panel");

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 320;
const COLLAPSE_THRESHOLD = 150;
const PROXIMITY_THRESHOLD = 30;
// Ya no depende del ancho de PropertiesPanel (PANEL_RIGHT_BASE+PANEL_GAP+
// panelWidth, como antes de moverse a DockRightWithTabs): los dos paneles
// nunca se muestran a la vez ahora (tabs separados), así que BcfPanel
// siempre ocupa el mismo hueco que PropertiesPanel ocupaba a solas - mismo
// valor que su propio PANEL_RIGHT (properties.css/PropertiesPanel.tsx).
const PANEL_RIGHT = 16;

interface BcfPanelProps {
  state: BcfManagerState;
  onFilterChange: (status: BcfFilterStatus) => void;
  onTopicSelect: (topic: BcfTopic | null) => void;
  onTopicActivate: (topic: BcfTopic) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
}

export function BcfPanel({ state, onFilterChange, onTopicSelect, onTopicActivate, moduleRuntime, hasModel }: BcfPanelProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [width, setWidth] = useState(COLLAPSED_WIDTH);
  const panelRef = useRef<HTMLDivElement>(null);
  const { setBcfPanelWidth } = usePanelWidth();

  const widthRef = useRef(width);
  widthRef.current = width;
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;
  const rafRef = useRef<number | null>(null);
  const pendingMouseXRef = useRef<number | null>(null);

  // Publica el propio ancho para que OrientationCube pueda correrse más a
  // la izquierda todavía (más allá de PropertiesPanel) - ver
  // PanelWidthContext.tsx/OrientationCube.tsx.
  useEffect(() => {
    setBcfPanelWidth(width);
  }, [width, setBcfPanelWidth]);

  // Mismo proximity-hover que PropertiesPanel.tsx (rAF-batched, umbral de
  // 1px, lee e.clientX de verdad), ahora con el mismo borde de reposo fijo
  // (PANEL_RIGHT) que PropertiesPanel, no uno dinámico - ver la nota de
  // PANEL_RIGHT más arriba.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPinnedRef.current) return;
      pendingMouseXRef.current = e.clientX;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const mouseX = pendingMouseXRef.current;
        if (mouseX === null) return;

        const distanceFromRight = window.innerWidth - mouseX;
        const currentLeftEdgeFromRight = PANEL_RIGHT + widthRef.current;
        const isOverPanel = distanceFromRight >= PANEL_RIGHT && distanceFromRight <= currentLeftEdgeFromRight;

        let nextWidth: number;
        if (isOverPanel) {
          nextWidth = EXPANDED_WIDTH;
        } else {
          const edgeFromRight = PANEL_RIGHT + COLLAPSED_WIDTH;
          const distanceToEdge = Math.max(0, distanceFromRight - edgeFromRight);
          if (distanceToEdge < PROXIMITY_THRESHOLD) {
            const proximityZone = PROXIMITY_THRESHOLD - distanceToEdge;
            nextWidth = Math.round(COLLAPSED_WIDTH + (proximityZone / PROXIMITY_THRESHOLD) * (EXPANDED_WIDTH - COLLAPSED_WIDTH));
          } else {
            nextWidth = COLLAPSED_WIDTH;
          }
        }

        if (Math.abs(nextWidth - widthRef.current) >= 1) {
          setWidth(nextWidth);
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPinned) setWidth(EXPANDED_WIDTH);
  }, [isPinned]);

  const isCollapsed = width < COLLAPSE_THRESHOLD;
  const filteredTopics =
    state.filters.status === "All" ? state.topics : state.topics.filter((t) => t.status === state.filters.status);

  return (
    <div
      ref={panelRef}
      className={`bcf-panel${isCollapsed ? " collapsed" : ""}`}
      style={{ "--bcf-panel-width": `${width}px` } as CSSProperties}
    >
      <div className="bcf-header">
        <h3 className="bcf-title">{isCollapsed ? "BCF" : "BCF Issues"}</h3>
        <button
          className={`bcf-pin-btn${isPinned ? " active" : ""}`}
          onClick={() => setIsPinned((v) => !v)}
          title={isPinned ? "Desfijar panel" : "Fijar panel"}
        >
          <IconLock />
        </button>
      </div>

      {/* Solo con el panel expandido: dos botones de 30px no entran bien
          en los 56px del panel colapsado, mismo criterio que ya aplicaba
          acá para el resto del contenido (FilterBar/IssueList). */}
      {!isCollapsed && (
        <div className="bcf-actions">
          {BCF_PANEL_MODULES.map((module) => {
            const moduleState = moduleRuntime[module.id] ?? {};
            const Icon = module.icon;
            return (
              <ToolbarButton
                key={module.id}
                id={`btn-${module.id}`}
                icon={<Icon />}
                label={module.label}
                onClick={moduleState.onClick}
                isActive={moduleState.isActive}
                disabled={module.requiresModel && !hasModel}
              />
            );
          })}
        </div>
      )}

      <FilterBar
        filter={state.filters.status}
        topicsCount={state.topics.length}
        filteredCount={filteredTopics.length}
        onFilterChange={onFilterChange}
      />

      <IssueList topics={filteredTopics} activeTopic={state.activeTopic} onSelect={onTopicSelect} onActivate={onTopicActivate} />
    </div>
  );
}
