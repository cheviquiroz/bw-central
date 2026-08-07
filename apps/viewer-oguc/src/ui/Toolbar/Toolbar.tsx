// src/ui/Toolbar/Toolbar.tsx
import { Fragment } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
  /**
   * Route to return to, e.g. "/" from /revision. Not a registry module -
   * this is route-chrome specific to whichever layout renders Toolbar,
   * not a structural part of the shared module vocabulary (registry
   * entries are meant to make sense on every surface that queries them;
   * "go back to the route I came from" only makes sense on one route).
   * Omitted entirely on "/" - no button renders.
   */
  backTo?: { label: string; path: string };
  /**
   * Route-specific action buttons rendered right before ProjectPill, e.g.
   * /revision's Guardar/Cargar/Exportar (ReviewActions.tsx) - same
   * reasoning as backTo: their state (findings, preCheckResults) is
   * owned by whichever route renders Toolbar, not something the shared
   * module registry should know about.
   */
  extraActions?: ReactNode;
}

// Only Section Box has a nested child today (Hide Plane) - a single
// direct child is rendered as an inline compact button next to its
// parent, visible only while the parent is active (a sub-state of the
// plane Section Box creates has no reason to exist before the plane
// does). If a module ever needs more than one child, this function is
// the one place that would need to grow past "children[0]".
// Exported for Toolbar3DFloating.tsx - same nested-child rendering
// (parent + its one visible sub-control, e.g. Section Box/Hide Plane),
// reused rather than re-implemented so the two surfaces can't drift.
export function renderModule(module: ModuleDefinition, runtime: ModuleRuntimeMap, hasModel: boolean) {
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
      shortcut={module.shortcut}
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

export function Toolbar({ searchBar, moduleRuntime, hasModel, backTo, extraActions }: ToolbarProps) {
  const navigate = useNavigate();
  const toolbarModules = getModulesForSurface("toolbar");
  // 'workspace' is excluded from MODULE_INTENT_ORDER's loop below and
  // rendered separately, right-aligned - see the ModuleIntent comment in
  // registry/modules.ts for why it's a different axis (acts on the user's
  // own panels, not on the model).
  const workspaceModules = toolbarModules.filter((m) => m.intent === "workspace");

  return (
    <header className="toolbar">
      <Logo />

      {backTo && (
        <>
          <button className="toolbar-back-btn" onClick={() => navigate(backTo.path)}>
            {backTo.label}
          </button>
          <ToolbarSeparator />
        </>
      )}

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

      {workspaceModules.length > 0 && (
        <>
          <div className="toolbar-group">{workspaceModules.map((m) => renderModule(m, moduleRuntime, hasModel))}</div>
          <ToolbarSeparator />
        </>
      )}

      {extraActions && (
        <>
          {extraActions}
          <ToolbarSeparator />
        </>
      )}

      {/* Sin dato real de federación/proyecto detrás - a diferencia del
          mockup, que hardcodea "Hospital La Serena", esto no debería
          inventar un nombre de proyecto que no existe en el dominio real. */}
      <ProjectPill label="Sesión local" />
    </header>
  );
}
