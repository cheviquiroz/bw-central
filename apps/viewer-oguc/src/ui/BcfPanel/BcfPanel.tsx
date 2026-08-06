// src/ui/BcfPanel/BcfPanel.tsx
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import { IconLock } from "../icons/dock";
import { IssueTable } from "./IssueTable";
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

interface BcfPanelProps {
  state: BcfManagerState;
  onFilterChange: (status: BcfFilterStatus) => void;
  onTopicSelect: (topic: BcfTopic | null) => void;
  onTopicActivate: (topic: BcfTopic) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
  /** Fase 3: este panel ya no controla su propia visibilidad (era zones.right, compartido con PropertiesPanel) - ahora vive en DockBottom, que le pasa el toggle de zones.bottom. */
  onClose: () => void;
}

export function BcfPanel({
  state,
  onFilterChange,
  onTopicSelect,
  onTopicActivate,
  moduleRuntime,
  hasModel,
  onClose,
}: BcfPanelProps) {
  const filteredTopics =
    state.filters.status === "All" ? state.topics : state.topics.filter((t) => t.status === state.filters.status);

  return (
    <div className="bcf-panel">
      <div className="bcf-header">
        <h3 className="bcf-title">Incidencias BCF</h3>
        <div className="bcf-header-actions">
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
          <FilterBar
            filter={state.filters.status}
            topicsCount={state.topics.length}
            filteredCount={filteredTopics.length}
            onFilterChange={onFilterChange}
          />
          <button className="bcf-pin-btn" onClick={onClose} title="Ocultar panel">
            <IconLock />
          </button>
        </div>
      </div>

      <IssueTable
        topics={filteredTopics}
        activeTopic={state.activeTopic}
        onSelect={onTopicSelect}
        onActivate={onTopicActivate}
      />
    </div>
  );
}
