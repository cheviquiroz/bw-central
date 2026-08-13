// src/ui/LayoutStateContext.tsx
//
// Replaces PanelWidthContext's isLeftDockOpen/isRightDockOpen pair (and,
// eventually, its whole reason to exist - see OrientationCube.tsx) with
// a single { left, right, bottom } object, per this task's explicit ask
// to lift panel visibility into ONE place instead of independent
// useState scattered across three components. This is the payoff of the
// module registry: the layout owns which zones are visible, panels just
// render into the zone they declared.
//
// Default is left:true, right:true, bottom:false - panels are visible by
// default (the whole point of this task: a docked panel that starts
// hidden isn't a panel, it's a dialog nobody summoned).
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadPersistedLayout, savePersistedLayout } from "./layoutPersistence";
import type { LayoutZones, PropertiesTab } from "./layoutPersistence";

export type { LayoutZones };

// Etapa 4b-1 - tipos del panel state, definidos ACÁ (no en
// layoutPersistence.ts, a diferencia de LayoutZones) porque su
// persistencia vive en una key de localStorage propia y separada
// ("bwise-panels-state-v1", ver más abajo), no en el mismo blob
// versionado que zones/anchos/alturas - no hay ciclo de import que
// evitar moviéndolos a otro archivo, así que se quedan donde se usan.
export type PanelId = "model-tree" | "file-manager" | "element-info" | "bcf" | "review-info" | "review-geometry" | "schedules";

export interface PanelPosition {
  open: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  dock: "free" | "left" | "right" | "bottom";
}

export type PanelState = Record<PanelId, PanelPosition>;

export const DEFAULT_LAYOUT_ZONES: LayoutZones = { left: true, right: true, bottom: false };

// Fase 5a: por debajo de este ancho, arrancar con los dos paneles
// laterales abiertos dejaría el canvas (mínimo 480px, ver Layout.css)
// apretado contra los 272px+272px+gutters de los docks. Se evalúa UNA
// sola vez, al montar (ver getDefaultZones más abajo) - no en cada
// resize de la ventana: encoger la ventana después de cargar no debe
// cerrarle paneles al usuario por sorpresa, solo el ESTADO INICIAL de una
// sesión sin nada persistido depende del ancho de pantalla. Este mismo
// criterio es por lo que el drag-resize de DockLeft/DockRight (ver
// ResizeHandle.tsx) tampoco oculta DockRight en vivo por debajo de un
// umbral de ventana - solo clampea su ANCHO al mínimo, nunca lo cierra
// solo, la decisión ya se tomó acá y no vale la pena repetirla con un
// criterio distinto en otro lugar del código.
const NARROW_SCREEN_BREAKPOINT_PX = 1280;

function getDefaultZones(): LayoutZones {
  if (typeof window !== "undefined" && window.innerWidth < NARROW_SCREEN_BREAKPOINT_PX) {
    return { left: true, right: false, bottom: false };
  }
  return DEFAULT_LAYOUT_ZONES;
}

export const DEFAULT_BOTTOM_DOCK_HEIGHT = 240;
export const MIN_BOTTOM_DOCK_HEIGHT = 120;
// El clamp superior es un porcentaje de la ventana (60vh), no un px fijo -
// se recalcula en el propio handler de resize (ver DockBottomShell.tsx),
// este valor solo documenta la regla.
export const MAX_BOTTOM_DOCK_HEIGHT_VH = 0.6;

// Ancho de los paneles laterales (DockLeft/DockRight) - antes un valor
// fijo de 272px hardcodeado en dock.css/dock-right.css, ahora el default
// de un valor continuo que el usuario puede arrastrar (ver
// ResizeHandle.tsx). 200px de mínimo es lo suficientemente angosto para
// seguir leyendo el árbol/propiedades sin que el contenido se vuelva
// ilegible; no hay un máximo fijo - el máximo real depende del ancho de
// la ventana y de si el OTRO panel lateral está visible, y se calcula en
// cada Dock (ver DockLeft.tsx/DockRight.tsx), no acá.
export const DEFAULT_SIDE_DOCK_WIDTH = 272;
export const MIN_SIDE_DOCK_WIDTH = 200;
// Ancho mínimo que el canvas central nunca debe perder - mismo valor que
// el piso de minmax(480px, 1fr) en Layout.css; repetido acá como
// constante (no importado desde el CSS, que no es posible) para que el
// cálculo de ancho máximo de cada dock lateral use el mismo número, no
// uno reescrito a mano que podría desincronizarse.
export const CANVAS_MIN_WIDTH = 480;

// Mirrors of the toolbar/gap tokens in src/styles/tokens.css
// (--toolbar-gap/--toolbar-clearance) - repetidos acá (no importables
// desde CSS, mismo motivo que CANVAS_MIN_WIDTH arriba) porque
// DockLeft.tsx/DockRight.tsx (Etapa 4a Fase 2) necesitan calcular su
// `height` inline en JS: es position:fixed y depende de bottomDockHeight
// (un número de estado, no expresable como token CSS estático), así que
// no alcanza con dejarle el alto a calc() en la hoja de estilos como sí
// se pudo hacer con el canvas en Fase 1. Si tokens.css cambia estos
// valores, hay que actualizar acá también - no hay forma de leer un
// custom property de CSS desde JS sin montar primero y leer
// getComputedStyle, lo que introduciría un round-trip que el resto de
// este archivo (cálculos de ancho síncronos, en render) no tiene hoy.
export const TOOLBAR_GAP = 20;
export const TOOLBAR_CLEARANCE = 84; // 20*2 + 44 (gap*2 + capsule height)
export const CANVAS_INSET = 5;
// 80px - mismo literal que .dock-panel/.dock-right usan para su propio
// `top` (dock.css/dock-right.css), a pedido explícito de acercar los
// docks al toolbar. Ya no se deriva de TOOLBAR_CLEARANCE + TOOLBAR_GAP
// (104px) - DockLeft.tsx/DockRight.tsx necesitan este número acá porque
// su `height` (`window.innerHeight - topOffset - bottomReserved`)
// depende de saber dónde arranca el panel, no solo el propio CSS `top`.
export const DOCK_TOP_OFFSET = 80;
// Mirror of --status-bar-clearance (tokens.css) - DockLeft.tsx/
// DockRight.tsx need this in JS for the same reason DOCK_TOP_OFFSET
// does: their `height` is computed from window.innerHeight, not left to
// a CSS calc(). Replaces the plain TOOLBAR_GAP that used to be the
// "margin to the window's bottom edge" term in that height formula -
// with .status-bar now floating there (position:fixed, Etapa 4a), that
// margin has to clear its full box (--canvas-inset + its height + a
// 16px gap), not just the old flat 20px.
export const STATUS_BAR_CLEARANCE = 47; // 5 (canvas-inset) + 26 (status-bar height) + 16 (gap)

// Etapa 4b-1: infraestructura de paneles flotantes (FloatingPanel.tsx) -
// coexiste con los docks fijos por ahora (DockLeft/DockRight/DockBottom
// no se tocan en esta fase salvo model-tree, ver Layout.tsx). Todos
// arrancan cerrados (open:false) - a diferencia de zones (left/right
// visibles por default), no hay razón todavía para que un panel
// flotante nuevo aparezca solo: el usuario lo abre a mano. Los 7 ids
// existen ya (tipos completos) aunque solo "model-tree" tiene una
// FloatingPanel real montada en esta fase - así el shape persistido no
// necesita volver a migrar cuando el resto se complete más adelante.
const PANEL_IDS: PanelId[] = ["model-tree", "file-manager", "element-info", "bcf", "review-info", "review-geometry", "schedules"];

// Key propia, versionada y separada del blob de layoutPersistence.ts (a
// pedido explícito) - "v1" porque es la primera vez que este shape
// existe, no una migración de algo anterior.
const PANELS_STORAGE_KEY = "bwise-panels-state-v1";

function isValidPanelPosition(value: unknown): value is PanelPosition {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as PanelPosition;
  return (
    typeof candidate.open === "boolean" &&
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.width) &&
    Number.isFinite(candidate.height) &&
    Number.isFinite(candidate.zIndex) &&
    (candidate.dock === "free" || candidate.dock === "left" || candidate.dock === "right" || candidate.dock === "bottom")
  );
}

interface PersistedPanelsState {
  panels: PanelState;
  maxZ: number;
}

function isValidPersistedPanelsState(value: unknown): value is PersistedPanelsState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedPanelsState>;
  if (typeof candidate.maxZ !== "number" || !Number.isFinite(candidate.maxZ)) return false;
  if (typeof candidate.panels !== "object" || candidate.panels === null) return false;
  const panels = candidate.panels as Partial<PanelState>;
  return PANEL_IDS.every((id) => isValidPanelPosition(panels[id]));
}

// Defensivo por diseño (try/catch, nunca lanza) - mismo criterio que
// loadPersistedLayout/savePersistedLayout en layoutPersistence.ts:
// persistir esto es un nice-to-have, nunca debe romper la app (quota
// excedida, modo privado, localStorage deshabilitado, JSON corrupto,
// shape de una versión vieja - todos caen a null/no-op).
function loadPersistedPanelsState(): PersistedPanelsState | null {
  try {
    const raw = window.localStorage.getItem(PANELS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPersistedPanelsState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePersistedPanelsState(state: PersistedPanelsState): void {
  try {
    window.localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ver el comentario de loadPersistedPanelsState.
  }
}

const FLOATING_PANEL_BASE_X = CANVAS_INSET + 15; // ~20px, mismo inset visual que los docks fijos usan hoy
const FLOATING_PANEL_BASE_Y = DOCK_TOP_OFFSET; // debajo del toolbar, mismo top que los docks fijos
const FLOATING_PANEL_WIDTH = 320;
const FLOATING_PANEL_HEIGHT = 500;
const FLOATING_PANEL_GAP = 16;
const FLOATING_PANEL_BOTTOM_MARGIN = 60;
const FLOATING_PANEL_CASCADE_STEP = 28;
const FLOATING_PANEL_BASE_Z = 20;

function makeDefaultPanelPosition(): PanelPosition {
  return {
    open: false,
    x: FLOATING_PANEL_BASE_X,
    y: FLOATING_PANEL_BASE_Y,
    width: FLOATING_PANEL_WIDTH,
    height: FLOATING_PANEL_HEIGHT,
    zIndex: FLOATING_PANEL_BASE_Z,
    dock: "free",
  };
}

function makeDefaultPanels(): PanelState {
  return Object.fromEntries(PANEL_IDS.map((id) => [id, makeDefaultPanelPosition()])) as PanelState;
}

// Cascada en apertura: los primeros DOS paneles abiertos reparten la
// columna izquierda en mitades apiladas (arriba/abajo); del tercero en
// adelante, cascada libre (cada uno 28px más abajo/a la derecha que el
// anterior) - mismo criterio visual que cualquier gestor de ventanas de
// escritorio usa para no apilar N ventanas exactamente una encima de
// otra. `openIndex` es la posición de ESTE panel dentro de la lista de
// paneles que van a quedar abiertos DESPUÉS de esta apertura (se lo pasa
// togglePanel ya calculado, ver más abajo) - no lee zIndex/maxZ para
// decidir el layout, solo para el z-index final de la ficha misma.
function calculateInitialPosition(openIndex: number, nextMaxZ: number): PanelPosition {
  const availableHeight = window.innerHeight - FLOATING_PANEL_BASE_Y - FLOATING_PANEL_BOTTOM_MARGIN;

  if (openIndex === 0) {
    return {
      open: true,
      x: FLOATING_PANEL_BASE_X,
      y: FLOATING_PANEL_BASE_Y,
      width: FLOATING_PANEL_WIDTH,
      height: availableHeight / 2,
      zIndex: nextMaxZ,
      dock: "free",
    };
  }

  if (openIndex === 1) {
    const firstPanelHeight = availableHeight / 2;
    return {
      open: true,
      x: FLOATING_PANEL_BASE_X,
      y: FLOATING_PANEL_BASE_Y + firstPanelHeight + FLOATING_PANEL_GAP,
      width: FLOATING_PANEL_WIDTH,
      height: availableHeight / 2 - FLOATING_PANEL_GAP,
      zIndex: nextMaxZ,
      dock: "free",
    };
  }

  const cascadeOffset = (openIndex - 2) * FLOATING_PANEL_CASCADE_STEP;
  return {
    open: true,
    x: FLOATING_PANEL_BASE_X + cascadeOffset,
    y: FLOATING_PANEL_BASE_Y + cascadeOffset,
    width: FLOATING_PANEL_WIDTH,
    height: FLOATING_PANEL_HEIGHT,
    zIndex: nextMaxZ,
    dock: "free",
  };
}

const DEFAULT_PROPERTIES_TAB: PropertiesTab = "PROPERTIES";

// Fase 5b: lo persistido (si existe y tiene un shape válido - ver
// layoutPersistence.ts) gana sobre los defaults calculados; el heurístico
// de pantalla angosta de getDefaultZones() solo aplica quien nunca guardó
// nada antes (primera visita real, o localStorage corrupto/vaciado).
function getInitialLayout() {
  const persisted = loadPersistedLayout();
  if (persisted) return persisted;
  return {
    zones: getDefaultZones(),
    propertiesTab: DEFAULT_PROPERTIES_TAB,
    bottomDockHeight: DEFAULT_BOTTOM_DOCK_HEIGHT,
    leftWidth: DEFAULT_SIDE_DOCK_WIDTH,
    rightWidth: DEFAULT_SIDE_DOCK_WIDTH,
  };
}

// Independiente de getInitialLayout() - key de localStorage propia (ver
// PANELS_STORAGE_KEY), así que se lee/cae a defaults por separado.
function getInitialPanelsState(): PersistedPanelsState {
  const persisted = loadPersistedPanelsState();
  if (persisted) return persisted;
  return { panels: makeDefaultPanels(), maxZ: FLOATING_PANEL_BASE_Z };
}

interface LayoutStateContextType {
  zones: LayoutZones;
  setZoneVisible: (zone: keyof LayoutZones, visible: boolean) => void;
  toggleZone: (zone: keyof LayoutZones) => void;
  bottomDockHeight: number;
  setBottomDockHeight: (height: number) => void;
  propertiesTab: PropertiesTab;
  setPropertiesTab: (tab: PropertiesTab) => void;
  leftWidth: number;
  setLeftWidth: (width: number) => void;
  rightWidth: number;
  setRightWidth: (width: number) => void;
  /** KeyboardShortcutsModal visibility - transient UI state, not persisted (see the save effect below, which deliberately doesn't include it). */
  showShortcuts: boolean;
  toggleShowShortcuts: () => void;
  /** Etapa 4b-1 - ver FloatingPanel.tsx. Persistido aparte (bwise-panels-state-v1), no en este mismo objeto - ver el comentario en PANELS_STORAGE_KEY. */
  panels: PanelState;
  maxZ: number;
  togglePanel: (id: PanelId) => void;
  updatePanelPosition: (id: PanelId, updates: Partial<PanelPosition>) => void;
  bringToFront: (id: PanelId) => void;
}

const LayoutStateContext = createContext<LayoutStateContextType | undefined>(undefined);

export function LayoutStateProvider({ children }: { children: ReactNode }) {
  // useState(getInitialLayout) sin llamarlo - lazy initializer, corre una
  // sola vez al montar, no en cada render. Los campos parten del MISMO
  // objeto leído/calculado una vez (no lecturas independientes de
  // localStorage) para que un layout persistido parcialmente corrupto no
  // pueda mezclar, por accidente, zones de una versión con
  // bottomDockHeight (o los anchos laterales) de otra.
  const [initialLayout] = useState(getInitialLayout);
  const [zones, setZones] = useState<LayoutZones>(initialLayout.zones);
  const [bottomDockHeight, setBottomDockHeight] = useState<number>(initialLayout.bottomDockHeight);
  const [propertiesTab, setPropertiesTab] = useState<PropertiesTab>(initialLayout.propertiesTab);
  const [leftWidth, setLeftWidth] = useState<number>(initialLayout.leftWidth);
  const [rightWidth, setRightWidth] = useState<number>(initialLayout.rightWidth);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const toggleShowShortcuts = () => setShowShortcuts((prev) => !prev);
  // Lazy initializer propio, misma razón que initialLayout arriba - y
  // separado de él porque lee de su propia key de localStorage.
  const [initialPanelsState] = useState(getInitialPanelsState);
  const [panels, setPanels] = useState<PanelState>(initialPanelsState.panels);
  const [maxZ, setMaxZ] = useState<number>(initialPanelsState.maxZ);

  const setZoneVisible = (zone: keyof LayoutZones, visible: boolean) => {
    setZones((prev) => ({ ...prev, [zone]: visible }));
  };

  const toggleZone = (zone: keyof LayoutZones) => {
    setZones((prev) => ({ ...prev, [zone]: !prev[zone] }));
  };

  // Cerrar nunca recalcula nada - solo apaga `open`, conservando x/y/
  // width/height/zIndex tal como estaban (relevante desde Etapa 4b-2,
  // cuando esos valores empiecen a venir de un drag/resize real, no solo
  // del cálculo en cascada). Abrir SÍ recalcula posición: openIndex es la
  // cantidad de paneles que van a quedar abiertos DESPUÉS de este menos
  // uno (este mismo panel incluido, al final de esa lista) - el orden de
  // apertura, no el orden fijo de PANEL_IDS, es lo que decide dónde cae
  // cada uno en la cascada.
  const togglePanel = (id: PanelId) => {
    setPanels((prev) => {
      const isOpening = !prev[id].open;
      if (!isOpening) {
        return { ...prev, [id]: { ...prev[id], open: false } };
      }
      const openCountBefore = Object.values(prev).filter((p) => p.open).length;
      const nextMaxZ = maxZ + 1;
      setMaxZ(nextMaxZ);
      return { ...prev, [id]: calculateInitialPosition(openCountBefore, nextMaxZ) };
    });
  };

  const updatePanelPosition = (id: PanelId, updates: Partial<PanelPosition>) => {
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const bringToFront = (id: PanelId) => {
    const nextMaxZ = maxZ + 1;
    setMaxZ(nextMaxZ);
    updatePanelPosition(id, { zIndex: nextMaxZ });
  };

  // Escribe en cada cambio, no solo al desmontar - esta app nunca se
  // desmonta en uso normal (es la app entera), así que "guardar al salir"
  // significaría, en la práctica, nunca guardar nada.
  useEffect(() => {
    savePersistedLayout({ zones, propertiesTab, bottomDockHeight, leftWidth, rightWidth });
  }, [zones, propertiesTab, bottomDockHeight, leftWidth, rightWidth]);

  // Efecto separado, key separada (PANELS_STORAGE_KEY) - mismo criterio
  // que el de arriba, pero panels/maxZ no viven en el blob de
  // layoutPersistence.ts (a pedido explícito, ver ese comentario).
  useEffect(() => {
    savePersistedPanelsState({ panels, maxZ });
  }, [panels, maxZ]);

  return (
    <LayoutStateContext.Provider
      value={{
        zones,
        setZoneVisible,
        toggleZone,
        bottomDockHeight,
        setBottomDockHeight,
        propertiesTab,
        setPropertiesTab,
        leftWidth,
        setLeftWidth,
        rightWidth,
        setRightWidth,
        showShortcuts,
        toggleShowShortcuts,
        panels,
        maxZ,
        togglePanel,
        updatePanelPosition,
        bringToFront,
      }}
    >
      {children}
    </LayoutStateContext.Provider>
  );
}

export function useLayoutState() {
  const context = useContext(LayoutStateContext);
  if (!context) {
    throw new Error("useLayoutState debe usarse dentro de LayoutStateProvider");
  }
  return context;
}
