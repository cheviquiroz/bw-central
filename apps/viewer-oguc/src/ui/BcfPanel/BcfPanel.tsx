// src/ui/BcfPanel/BcfPanel.tsx
import { useEffect } from "react";
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

interface BcfPanelProps {
  state: BcfManagerState;
  onFilterChange: (status: BcfFilterStatus) => void;
  onTopicSelect: (topic: BcfTopic | null) => void;
  onTopicActivate: (topic: BcfTopic) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
}

export function BcfPanel({ state, onFilterChange, onTopicSelect, onTopicActivate, moduleRuntime, hasModel }: BcfPanelProps) {
  // isRightDockOpen es compartido con PropertiesPanel (misma tab-slot
  // desde la Fase 3) - ver PanelWidthContext.tsx. Reemplaza tanto el
  // viejo isPinned como la interpolación de ancho por proximity-hover:
  // abrir/cerrar es ahora binario y solo pasa por click.
  const { isRightDockOpen, setIsRightDockOpen, setBcfPanelWidth } = usePanelWidth();
  const width = isRightDockOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  // Publica el propio ancho para que OrientationCube pueda correrse más a
  // la izquierda todavía (más allá de PropertiesPanel) - ver
  // PanelWidthContext.tsx/OrientationCube.tsx.
  useEffect(() => {
    setBcfPanelWidth(width);
  }, [width, setBcfPanelWidth]);

  const isCollapsed = !isRightDockOpen;
  const filteredTopics =
    state.filters.status === "All" ? state.topics : state.topics.filter((t) => t.status === state.filters.status);

  return (
    <div className={`bcf-panel${isCollapsed ? " collapsed" : ""}`} style={{ "--bcf-panel-width": `${width}px` } as CSSProperties}>
      <div className="bcf-header">
        <h3 className="bcf-title">{isCollapsed ? "BCF" : "BCF Issues"}</h3>
        {/* Antes alternaba isPinned - ya no hay proximity-hover del que
            "pinnear" (ver PanelWidthContext.tsx), así que esto es
            simplemente cerrar el panel, no un toggle con estado propio. */}
        <button className="bcf-pin-btn" onClick={() => setIsRightDockOpen(false)} title="Cerrar panel">
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
