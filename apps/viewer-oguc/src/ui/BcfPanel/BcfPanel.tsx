// src/ui/BcfPanel/BcfPanel.tsx
import { useEffect, useState } from "react";
import type { BcfFilterStatus, BcfManagerState, BcfPriority, BcfTopic } from "../../viewer/bcf/types/bcf";
import { IconLock } from "../icons/dock";
import { IssueTable } from "./IssueTable";
import { BcfDetailPanel } from "./BcfDetailPanel";
import { CreateTopicDialog } from "./CreateTopicDialog";
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
  /** viewpointIndex optional - BcfDetailPanel passes it explicitly, IssueTable's double-click omits it (defaults to 0 upstream in Layout.tsx). */
  onTopicActivate: (topic: BcfTopic, viewpointIndex?: number) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
  /** Fase 3: este panel ya no controla su propia visibilidad (era zones.right, compartido con PropertiesPanel) - ahora vive en DockBottom, que le pasa el toggle de zones.bottom. */
  onClose: () => void;
  /**
   * Dialog visibility + submit live in Layout.tsx (the "bcf-create"
   * module's onClick sets it, via moduleRuntime, same as every other
   * module here) - not local BcfPanel state. Matches the existing
   * onFilterChange/onTopicSelect/onTopicActivate pattern: this
   * component never touches BcfManager directly, it only relays.
   */
  createDialogOpen: boolean;
  onCreateDialogClose: () => void;
  onCreateTopicSubmit: (title: string, description: string, priority: BcfPriority) => boolean;
}

export function BcfPanel({
  state,
  onFilterChange,
  onTopicSelect,
  onTopicActivate,
  moduleRuntime,
  hasModel,
  onClose,
  createDialogOpen,
  onCreateDialogClose,
  onCreateTopicSubmit,
}: BcfPanelProps) {
  const filteredTopics =
    state.filters.status === "All" ? state.topics : state.topics.filter((t) => t.status === state.filters.status);

  // Purely a display concern (which viewpoint row is highlighted inside
  // BcfDetailPanel) - doesn't need to live in BcfManager alongside
  // activeTopic itself. Resets to 0 (the primary viewpoint) whenever a
  // DIFFERENT topic becomes active, so switching topics never shows a
  // stale highlight left over from the previous one's viewpoint list.
  const [selectedViewpointIndex, setSelectedViewpointIndex] = useState(0);
  useEffect(() => {
    setSelectedViewpointIndex(0);
  }, [state.activeTopic?.guid]);

  return (
    <div className="bcf-panel">
      <div className="bcf-header">
        <h3 className="bcf-title">Incidencias BCF</h3>
        {state.isNewProject && <span className="badge-new-bcf">BCF (sin guardar)</span>}
        <div className="bcf-header-actions">
          {BCF_PANEL_MODULES.map((module) => {
            const moduleState = moduleRuntime[module.id] ?? {};
            const Icon = module.icon;
            // Only bcf-export's label ever varies at runtime (per
            // state.isNewProject) - every other module's label stays
            // exactly what the registry declares, structure, not
            // runtime-computed text.
            const label = module.id === "bcf-export" && state.isNewProject ? "Exportar BCF nuevo" : module.label;
            return (
              <ToolbarButton
                key={module.id}
                id={`btn-${module.id}`}
                icon={<Icon />}
                label={label}
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

      <div className="bcf-body">
        <IssueTable
          topics={filteredTopics}
          activeTopic={state.activeTopic}
          onSelect={onTopicSelect}
          onActivate={onTopicActivate}
        />
        <BcfDetailPanel
          activeTopic={state.activeTopic}
          selectedViewpointIndex={selectedViewpointIndex}
          onViewpointClick={(index) => {
            if (!state.activeTopic) return;
            setSelectedViewpointIndex(index);
            onTopicActivate(state.activeTopic, index);
          }}
        />
      </div>

      <CreateTopicDialog isOpen={createDialogOpen} onClose={onCreateDialogClose} onSubmit={onCreateTopicSubmit} />
    </div>
  );
}
