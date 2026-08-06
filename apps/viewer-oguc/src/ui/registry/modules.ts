// src/ui/registry/modules.ts
//
// Single declarative source of truth for every UI module (toolbar
// button, nested sub-control, or panel). Toolbar.tsx and, eventually,
// DockRightWithTabs/BcfPanel read from this instead of hardcoding a
// button list - adding a module becomes adding an entry here, not
// editing three files by hand every time.
//
// This file describes STRUCTURE only. It does not hold onClick handlers
// or isActive booleans - those still live in Layout.tsx (the single
// place that owns application state, per this project's existing
// AppContext/PanelWidthContext convention) and get matched to a module
// by `id` at render time via a ModuleRuntimeMap (see the bottom of this
// file). The registry never becomes a second source of truth for state.

import type { ComponentType } from "react";
import {
  IconMeasure,
  IconIsolate,
  IconSectionBox,
  IconHidePlane,
  IconFitAll,
  IconXYZ,
  IconBcfImport,
  IconBcfExport,
} from "../icons/toolbar";

export type ModuleIntent = "explore" | "interrogate" | "communicate" | "review";
export type ModuleKind = "action" | "toggle" | "panel";
export type ModuleTier = "free" | "pro";
export type ModuleZone = "left" | "right" | "bottom";

/**
 * Where a module's control actually renders. Not in the brief's original
 * type sketch - added because BCF import/export (Phase 3) need to render
 * inside BcfPanel, not the Toolbar, and a registry that only ever renders
 * to one place isn't really a registry, it's a toolbar config with extra
 * steps. Defaults to "toolbar" when omitted (every module before Phase 3
 * needed it). Kept separate from `zone`, which is specifically about
 * which SIDE a `kind:'panel'` module docks to - `surface` is about which
 * PARENT COMPONENT queries the registry for this entry at all.
 */
export type ModuleSurface = "toolbar" | "bcf-panel";

export interface ModuleDefinition {
  id: string;
  /** Spanish (Chile), shown in the custom tooltip. */
  label: string;
  /** Drives toolbar grouping - see ModuleIntent. */
  intent: ModuleIntent;
  kind: ModuleKind;
  icon: ComponentType;
  /** Only meaningful for kind:'panel'. */
  zone?: ModuleZone;
  /** Only meaningful for kind:'panel'. */
  component?: ComponentType;
  /** Which component queries this entry. Defaults to "toolbar" if omitted. */
  surface?: ModuleSurface;
  /** Disabled when no model is loaded. */
  requiresModel: boolean;
  /**
   * Inert today - every module is 'free' and nothing filters on it. This
   * exists so that filtering by plan later is a one-line predicate change
   * instead of a refactor. Do not build a plan/subscription system around
   * this field; it is structure, not behavior, until a real product
   * decision says otherwise.
   */
  tier: ModuleTier;
  /**
   * Nested sub-controls, only rendered while the parent's own isActive is
   * true (see Toolbar.tsx) - e.g. Hide Plane only exists on screen while
   * Section Box is on, because it is a sub-state of the plane Section Box
   * creates, not a sibling tool.
   */
  children?: ModuleDefinition[];
}

/**
 * Runtime state for a module, matched to its ModuleDefinition by `id`.
 * Built in Layout.tsx (the owner of all application state) and passed
 * down as a single map instead of one prop per button - this is the
 * actual payoff of the registry: Toolbar.tsx needs zero changes to gain
 * a new module, only a new registry entry plus a new entry in this map.
 */
export interface ModuleRuntimeState {
  onClick?: () => void;
  isActive?: boolean;
}

export type ModuleRuntimeMap = Record<string, ModuleRuntimeState>;

// INTENT groups, in the fixed display order the Toolbar renders them in:
// explore (orient/navigate) -> interrogate (question the model) ->
// communicate (produce output for others) -> review (compliance checks -
// nothing today, /revision lands here later). An intent with zero
// registry entries renders no group at all - see Toolbar.tsx.
export const MODULE_INTENT_ORDER: ModuleIntent[] = ["explore", "interrogate", "communicate", "review"];

export const MODULE_REGISTRY: ModuleDefinition[] = [
  // explore - orient and navigate the camera/scene.
  {
    id: "fit-all",
    label: "Encuadrar todo (Z)",
    intent: "explore",
    kind: "action",
    icon: IconFitAll,
    requiresModel: true,
    tier: "free",
  },
  {
    id: "axes",
    label: "Mostrar origen XYZ (0,0,0)",
    intent: "explore",
    kind: "toggle",
    icon: IconXYZ,
    requiresModel: true,
    tier: "free",
  },
  {
    id: "section-box",
    label: "Section Box",
    intent: "explore",
    kind: "toggle",
    icon: IconSectionBox,
    requiresModel: true,
    tier: "free",
    children: [
      {
        id: "hide-plane",
        label: "Ocultar plano (el corte sigue activo)",
        intent: "explore",
        kind: "toggle",
        icon: IconHidePlane,
        requiresModel: true,
        tier: "free",
      },
    ],
  },

  // interrogate - question the model. Search is conceptually here too,
  // but it is not a ToolbarButton (it is the embedded SearchBar, its own
  // input+dropdown), so it stays outside the registry and keeps its fixed
  // position in Toolbar.tsx, exactly like Logo/ProjectPill.
  {
    id: "measure",
    label: "Medir",
    intent: "interrogate",
    kind: "toggle",
    icon: IconMeasure,
    requiresModel: true,
    tier: "free",
  },
  {
    id: "isolate",
    label: "Aislar Selección",
    intent: "interrogate",
    kind: "toggle",
    icon: IconIsolate,
    requiresModel: true,
    tier: "free",
  },

  // communicate - produce output for others. `surface: "toolbar"` is
  // temporary: these move to "bcf-panel" (rendered inside BcfPanel's
  // "Incidencias" tab instead of the Toolbar) once that panel actually
  // renders them - flipping the value before the render target exists
  // would make these two buttons unreachable in the UI for a whole
  // commit's window.
  {
    id: "bcf-import",
    label: "Importar BCF",
    intent: "communicate",
    kind: "action",
    icon: IconBcfImport,
    surface: "toolbar",
    requiresModel: true,
    tier: "free",
  },
  {
    id: "bcf-export",
    label: "Exportar BCF",
    intent: "communicate",
    kind: "action",
    icon: IconBcfExport,
    surface: "toolbar",
    requiresModel: true,
    tier: "free",
  },

  // review - compliance checks. Nothing today; /revision lands here.
];

export function getModulesForSurface(surface: ModuleSurface): ModuleDefinition[] {
  return MODULE_REGISTRY.filter((m) => (m.surface ?? "toolbar") === surface);
}
