// src/ui/Toolbar/Toolbar.tsx
import { Fragment } from "react";
import type { ReactNode } from "react";
import "../../styles/toolbar.css";
import { Logo } from "./Logo";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ProjectPill } from "./ProjectPill";
import { MODULE_INTENT_ORDER, getModulesForSurface } from "../registry/modules";
import type { ModuleDefinition, ModuleRuntimeMap } from "../registry/modules";

interface ToolbarProps {
  searchBar: ReactNode;
  /** Real onClick/isActive per module id - built in Layout.tsx, the single owner of application state. The registry only describes structure. */
  moduleRuntime: ModuleRuntimeMap;
  /** Disables every requiresModel:true module when no model is loaded. */
  hasModel: boolean;
}

// Only Section Box has a nested child today (Hide Plane) - a single
// direct child is rendered as an inline compact button next to its
// parent, visible only while the parent is active (a sub-state of the
// plane Section Box creates has no reason to exist before the plane
// does). If a module ever needs more than one child, this function is
// the one place that would need to grow past "children[0]".
function renderModule(module: ModuleDefinition, runtime: ModuleRuntimeMap, hasModel: boolean) {
  const state = runtime[module.id] ?? {};
  const disabled = module.requiresModel && !hasModel;
  const Icon = module.icon;
  const child = module.children?.[0];
  const childVisible = Boolean(child && state.isActive);

  const parentButton = (
    <ToolbarButton
      id={`btn-${module.id}`}
      icon={<Icon />}
      label={module.label}
      onClick={state.onClick}
      isActive={state.isActive}
      disabled={disabled}
    />
  );

  if (!child) return <Fragment key={module.id}>{parentButton}</Fragment>;

  const childState = runtime[child.id] ?? {};
  const ChildIcon = child.icon;

  return (
    <div key={module.id} className={`toolbar-btn-cluster${childVisible ? " has-child" : ""}`}>
      {parentButton}
      {childVisible && (
        <ToolbarButton
          id={`btn-${child.id}`}
          icon={<ChildIcon />}
          label={child.label}
          onClick={childState.onClick}
          isActive={childState.isActive}
          disabled={disabled}
          compact
        />
      )}
    </div>
  );
}

export function Toolbar({ searchBar, moduleRuntime, hasModel }: ToolbarProps) {
  const toolbarModules = getModulesForSurface("toolbar");

  return (
    <header className="toolbar">
      <Logo />

      {MODULE_INTENT_ORDER.map((intent) => {
        const modules = toolbarModules.filter((m) => m.intent === intent);
        // Un intent sin módulos visibles no renderiza nada - ni grupo
        // vacío, ni separador huérfano. 'review' es exactamente este caso
        // hoy (nada todavía; /revision llega ahí más adelante).
        if (modules.length === 0) return null;
        return (
          <Fragment key={intent}>
            <div className="toolbar-group">{modules.map((m) => renderModule(m, moduleRuntime, hasModel))}</div>
            <ToolbarSeparator />
          </Fragment>
        );
      })}

      {searchBar}

      <div className="toolbar-spacer" />

      {/* Sin dato real de federación/proyecto detrás - a diferencia del
          mockup, que hardcodea "Hospital La Serena", esto no debería
          inventar un nombre de proyecto que no existe en el dominio real. */}
      <ProjectPill label="Sesión local" />
    </header>
  );
}
