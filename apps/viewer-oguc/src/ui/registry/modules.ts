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
// AppContext/LayoutStateContext convention) and get matched to a module
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
  IconBcfCreate,
  IconPanelTree,
  IconPanelData,
  IconPanelIssues,
  IconCheckCircle,
  IconFileManager,
  IconReviewInfo,
  IconReviewGeometry,
  IconSchedules,
} from "../icons/toolbar";

/**
 * 'workspace' is deliberately not in MODULE_INTENT_ORDER: that order
 * governs the left-aligned tool groups (actions ON the model). Workspace
 * toggles act on the user's OWN workspace (which panels are visible) -
 * same distinction VS Code/Figma make between a command-palette action
 * and a panel-visibility toggle. Toolbar.tsx renders this intent as its
 * own right-aligned group, not folded into MODULE_INTENT_ORDER's loop.
 */
export type ModuleIntent = "explore" | "interrogate" | "communicate" | "review" | "workspace";
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
 *
 * Deliberately not a closed union of just the two surfaces that exist
 * today: paid modules and /revision will add their own render targets
 * (a review-results panel, a bottom drawer, etc.), and a closed union
 * would mean editing this central file for every new consumer instead of
 * the consumer just declaring its own surface name. The `(string & {})`
 * member keeps autocomplete/typo-catching for the known values below
 * while still accepting any other string a future component picks - see
 * https://www.totaltypescript.com/the-string-and-boolean-trick for why
 * this trick doesn't collapse the union down to plain `string`.
 */
export type ModuleSurface = "toolbar" | "bcf-panel" | (string & {});

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
  /** Shown alongside the label in the custom Tooltip, e.g. "Ctrl+1". Optional - most modules have no bound shortcut. */
  shortcut?: string;
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
  // explore - orient and navigate the camera/scene. surface:
  // "toolbar-3d-floating" moves these off the global Toolbar into
  // Toolbar3DFloating (see that component and registry/modules-3d-floating.ts)
  // - they act ON the 3D scene, not on the app shell, so they only make
  // sense floating over the viewport that has one. Definitions stay here,
  // not duplicated into a second array: this file's own header comment
  // ("single declarative source of truth") already ruled out a second
  // registry holding copies of the same structure.
  {
    id: "fit-all",
    label: "Encuadrar todo (Z)",
    intent: "explore",
    kind: "action",
    icon: IconFitAll,
    surface: "toolbar-3d-floating",
    requiresModel: true,
    tier: "free",
  },
  {
    id: "axes",
    label: "Mostrar origen XYZ (0,0,0)",
    intent: "explore",
    kind: "toggle",
    icon: IconXYZ,
    surface: "toolbar-3d-floating",
    requiresModel: true,
    tier: "free",
  },
  {
    id: "section-box",
    label: "Section Box",
    intent: "explore",
    kind: "toggle",
    icon: IconSectionBox,
    surface: "toolbar-3d-floating",
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
    surface: "toolbar-3d-floating",
    requiresModel: true,
    tier: "free",
  },
  {
    id: "isolate",
    label: "Aislar Selección",
    intent: "interrogate",
    kind: "toggle",
    icon: IconIsolate,
    surface: "toolbar-3d-floating",
    requiresModel: true,
    tier: "free",
  },

  // communicate - produce output for others. Renders inside BcfPanel's
  // "Incidencias" tab, not the Toolbar: importing a BCF is a workflow
  // action that produces content in that panel, and the user is already
  // looking at it when they need this - keeping it in the top toolbar
  // separated the action from its result.
  {
    id: "bcf-import",
    label: "Importar BCF",
    intent: "communicate",
    kind: "action",
    icon: IconBcfImport,
    surface: "bcf-panel",
    requiresModel: true,
    tier: "free",
  },
  {
    id: "bcf-export",
    label: "Exportar BCF",
    intent: "communicate",
    kind: "action",
    icon: IconBcfExport,
    surface: "bcf-panel",
    requiresModel: true,
    tier: "free",
  },
  {
    id: "bcf-create",
    label: "Crear incidencia",
    intent: "communicate",
    kind: "action",
    icon: IconBcfCreate,
    surface: "bcf-panel",
    requiresModel: true,
    tier: "free",
  },

  // review - compliance checks. start-review is the /revision entry
  // point - structure only, same as every other module here (the
  // registry never holds onClick/isActive - see the file header comment).
  // Layout.tsx's moduleRuntime wires the actual navigate('/revision')
  // call, same pattern as every other module's handler.
  {
    id: "start-review",
    label: "Revisar OGUC",
    intent: "review",
    kind: "action",
    icon: IconCheckCircle,
    requiresModel: true,
    tier: "free",
  },

  // workspace - toggles the user's OWN panels (visibility), not a tool
  // acting on the model. Rendered by Toolbar.tsx as a separate,
  // right-aligned group (after SearchBar, before ProjectPill) - see the
  // ModuleIntent comment above for why this is its own axis.
  //
  // requiresModel is a per-module judgment call, not a blanket "workspace
  // = free" rule. panel-tree used to be the one exception (its empty state
  // hosted the upload entry point) but that reasoning didn't survive
  // contact with FileUploadModal: that full-screen overlay is the actual
  // upload flow, and it renders BELOW the dock's z-index (see
  // file-upload-modal.css) - so DockLeft's "Sin modelos cargados todavía"
  // state was rendering visibly on top of the upload modal it was meant
  // to justify, not hosting an alternate way in. All three workspace
  // panels now require a model for the same reason: an empty panel with
  // nothing to show and no unique action to offer has no purpose being
  // open yet.
  {
    id: "panel-tree",
    label: "Árbol del modelo",
    intent: "workspace",
    kind: "toggle",
    icon: IconPanelTree,
    requiresModel: true,
    tier: "free",
    shortcut: "Ctrl+1",
  },
  {
    id: "panel-data",
    label: "Datos",
    intent: "workspace",
    kind: "toggle",
    icon: IconPanelData,
    requiresModel: true,
    tier: "free",
    shortcut: "Ctrl+2",
  },
  {
    id: "panel-issues",
    label: "Incidencias",
    intent: "workspace",
    kind: "toggle",
    icon: IconPanelIssues,
    requiresModel: true,
    tier: "free",
    shortcut: "Ctrl+3",
  },

  // Etapa 4b-4 - 4 módulos nuevos para los paneles que todavía no
  // existían como botón de toolbar (file-manager/review-info/
  // review-geometry/schedules). "element-info" NO se agrega acá a
  // propósito: ya existe como "panel-data" arriba, pero ese botón sigue
  // controlando DockRight/zones.right (el dock fijo real), no
  // panels["element-info"] (que existe en el tipo PanelId desde 4b-1
  // pero no tiene ningún FloatingPanel montado todavía - ver
  // LayoutStateContext.tsx). Agregar un segundo botón que llamara a
  // togglePanel("element-info") habría creado exactamente el "segundo
  // sistema de botones compitiendo" que este brief pide evitar: dos
  // toggles con el mismo label conceptual ("info del elemento"), uno
  // real (panel-data) y uno mudo (no dibuja nada). Cuando element-info
  // se migre de verdad a FloatingPanel, panel-data es el módulo que debe
  // apuntar a togglePanel("element-info") en vez de toggleZone("right") -
  // no un módulo nuevo.
  //
  // requiresModel: el brief pedía "siempre habilitado" para
  // model-tree/bcf, pero panel-tree/panel-issues (arriba) ya tienen
  // requiresModel:true por una razón real y documentada (ver el
  // comentario sobre FileUploadModal más arriba en este archivo) - no se
  // tocó esa regla existente acá. file-manager y schedules sí se dejan
  // sin requiresModel (true "siempre habilitado", sin precedente en
  // conflicto); review-info/review-geometry sí lo requieren, siguiendo
  // el mismo criterio ya establecido para el resto del grupo workspace.
  {
    id: "panel-file-manager",
    label: "Gestor de archivos",
    intent: "workspace",
    kind: "toggle",
    icon: IconFileManager,
    requiresModel: false,
    tier: "free",
  },
  {
    id: "panel-review-info",
    label: "Info de revisión",
    intent: "workspace",
    kind: "toggle",
    icon: IconReviewInfo,
    requiresModel: true,
    tier: "free",
  },
  {
    id: "panel-review-geometry",
    label: "Geometría de revisión",
    intent: "workspace",
    kind: "toggle",
    icon: IconReviewGeometry,
    requiresModel: true,
    tier: "free",
  },
  {
    id: "panel-schedules",
    label: "Itemizados",
    intent: "workspace",
    kind: "toggle",
    icon: IconSchedules,
    requiresModel: false,
    tier: "free",
  },
];

export function getModulesForSurface(surface: ModuleSurface): ModuleDefinition[] {
  return MODULE_REGISTRY.filter((m) => (m.surface ?? "toolbar") === surface);
}
