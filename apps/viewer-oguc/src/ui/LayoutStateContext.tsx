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

// Etapa 4c-1 - grid de docking 2x2. `mode`/`dockSlot` son los ÚNICOS
// campos nuevos acá - a diferencia del brief original de esta fase, que
// proponía volver x/y/width/height/zIndex OPCIONALES ("solo si
// mode=free"), se dejaron intactos y siempre-presentes: son lo que
// calculateInitialPosition/isValidPanelPosition/FloatingPanel.tsx ya
// leen sin chequeo de undefined en cada línea desde Etapa 4b-1/4b-2, y
// un panel DOCKED sigue necesitando recordar su última posición/tamaño
// libre - si el usuario lo saca del grid (Etapa 4c-2, drag-to-swap fuera
// de un slot, o un futuro botón "flotar"), tiene que reaparecer donde
// estaba, no en un x/y inventado de cero. `dockSlot` es `DockingSlot |
// null` (no opcional) por el mismo motivo que el resto de este archivo
// nunca usa `?:` para campos siempre-presentes-pero-a-veces-vacíos.
export type DockingSlot = "left-top" | "left-bottom" | "right-top" | "right-bottom";

export interface PanelPosition {
  open: boolean;
  mode: "free" | "docked";
  dockSlot: DockingSlot | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  dock: "free" | "left" | "right" | "bottom";
}

export type PanelState = Record<PanelId, PanelPosition>;

// Etapa 4c-1 - qué panel vive en cada columna/slot del grid 2x2, y las
// dimensiones continuas (arrastrables) del grid mismo. NO incluye
// `dividerX` (el brief original lo proponía como posición x absoluta del
// separador vertical) - CSS flexbox ya deriva esa posición sola de
// leftColumnWidth/rightColumnWidth (ver docking-container.css), llevar
// un tercer número aparte solo para que quedara sincronizado con esos
// dos habría sido puro estado derivado repetido, sin ningún consumidor
// real que lo necesitara como px absoluto. Mismo motivo por el que NO
// hay un calculateSlotGeometry acá (el brief sí lo pedía): ese cálculo
// devolvía x/y absolutos para un layout que, en la implementación real,
// es un flex row de dos columnas - flexbox ya resuelve exactamente ese
// problema (ancho fijo por columna + gap), no hay razón para
// reimplementarlo a mano en JS.
export interface DockingLayout {
  leftColumn: PanelId[]; // max 2: [top, bottom]
  rightColumn: PanelId[]; // max 2: [top, bottom]
  leftColumnWidth: number;
  rightColumnWidth: number;
  leftTopHeight: number; // solo relevante si leftColumn.length === 2
  rightTopHeight: number; // solo relevante si rightColumn.length === 2
}

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

const VALID_DOCK_SLOTS: DockingSlot[] = ["left-top", "left-bottom", "right-top", "right-bottom"];

function isValidPanelPosition(value: unknown): value is PanelPosition {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as PanelPosition;
  return (
    typeof candidate.open === "boolean" &&
    (candidate.mode === "free" || candidate.mode === "docked") &&
    (candidate.dockSlot === null || VALID_DOCK_SLOTS.includes(candidate.dockSlot)) &&
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
    // mode/dockSlot no importan mientras open:false - togglePanel decide
    // el modo real al abrir (ver más abajo). free/null acá es solo un
    // valor neutro de arranque, no una preferencia.
    mode: "free",
    dockSlot: null,
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
      mode: "free",
      dockSlot: null,
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
      mode: "free",
      dockSlot: null,
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
    mode: "free",
    dockSlot: null,
    x: FLOATING_PANEL_BASE_X + cascadeOffset,
    y: FLOATING_PANEL_BASE_Y + cascadeOffset,
    width: FLOATING_PANEL_WIDTH,
    height: FLOATING_PANEL_HEIGHT,
    zIndex: nextMaxZ,
    dock: "free",
  };
}

// Etapa 4c-1 - grid de docking. Key propia y separada, mismo criterio que
// PANELS_STORAGE_KEY (ver ese comentario) - "v1" porque es la primera
// vez que este shape existe.
const DOCKING_STORAGE_KEY = "bwise-docking-layout-v1";

const DEFAULT_DOCKING_LAYOUT: DockingLayout = {
  leftColumn: [],
  rightColumn: [],
  leftColumnWidth: FLOATING_PANEL_WIDTH,
  rightColumnWidth: FLOATING_PANEL_WIDTH,
  leftTopHeight: 400,
  rightTopHeight: 400,
};

// Mismo mínimo que un FloatingPanel libre ya respeta (MIN_WIDTH en
// FloatingPanel.tsx) - una columna del grid no tiene ninguna razón para
// poder volverse más angosta que el panel libre equivalente.
export const MIN_DOCKING_COLUMN_WIDTH = 280;
export const MIN_DOCKING_ROW_HEIGHT = 150;

function isValidPanelIdArray(value: unknown): value is PanelId[] {
  return Array.isArray(value) && value.length <= 2 && value.every((id) => PANEL_IDS.includes(id));
}

function isValidDockingLayout(value: unknown): value is DockingLayout {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DockingLayout>;
  return (
    isValidPanelIdArray(candidate.leftColumn) &&
    isValidPanelIdArray(candidate.rightColumn) &&
    Number.isFinite(candidate.leftColumnWidth) &&
    Number.isFinite(candidate.rightColumnWidth) &&
    Number.isFinite(candidate.leftTopHeight) &&
    Number.isFinite(candidate.rightTopHeight)
  );
}

// Defensivo por diseño, mismo criterio que loadPersistedPanelsState -
// nunca lanza, un shape viejo/corrupto cae a null (-> default).
function loadPersistedDockingLayout(): DockingLayout | null {
  try {
    const raw = window.localStorage.getItem(DOCKING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidDockingLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePersistedDockingLayout(layout: DockingLayout): void {
  try {
    window.localStorage.setItem(DOCKING_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ver el comentario de loadPersistedDockingLayout.
  }
}

function getInitialDockingLayout(): DockingLayout {
  return loadPersistedDockingLayout() ?? DEFAULT_DOCKING_LAYOUT;
}

// Reparte la altura disponible del grid 50/50 entre los dos paneles de
// una columna con 2 elementos, o le da el 100% al único panel si solo
// hay uno - misma regla en ambas columnas, función pura (no muta
// `layout`, a diferencia del brief original: el resto de este archivo
// nunca muta estado en el lugar, togglePanel/updatePanelPosition/etc.
// siempre devuelven un objeto nuevo). gridHeight se recalcula acá mismo
// (no se cachea en el layout persistido) por el mismo motivo que
// DockLeft/DockRight recalculan su altura en cada render en vez de
// guardarla: la ventana pudo cambiar de tamaño entre sesiones.
function recalculateDockingHeights(layout: DockingLayout): DockingLayout {
  const gridHeight = window.innerHeight - TOOLBAR_CLEARANCE - STATUS_BAR_CLEARANCE - FLOATING_PANEL_GAP;
  const leftTopHeight = layout.leftColumn.length === 2 ? (gridHeight - FLOATING_PANEL_GAP) / 2 : gridHeight;
  const rightTopHeight = layout.rightColumn.length === 2 ? (gridHeight - FLOATING_PANEL_GAP) / 2 : gridHeight;
  return { ...layout, leftTopHeight, rightTopHeight };
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
  /** Etapa 4c-1 - grid de docking 2x2. Persistido aparte (bwise-docking-layout-v1) - ver DOCKING_STORAGE_KEY. */
  dockingLayout: DockingLayout;
  updateDockingLayout: (updates: Partial<DockingLayout>) => void;
  /** Devuelve false si el grid ya tiene 4 paneles docked y preferSlot no apunta a un slot libre - el caller (togglePanel) decide qué hacer en ese caso (hoy: abrir libre). */
  addPanelToDocking: (id: PanelId, preferSlot?: DockingSlot) => boolean;
  removePanelFromDocking: (id: PanelId) => void;
  /** Etapa 4c-1: función completa, sin UI que la dispare todavía (eso es Etapa 4c-2, drag-to-swap entre slots) - se agrega ahora porque forma parte de la superficie de estado que ese siguiente sub-fase va a necesitar de inmediato, no porque haya algo que la llame hoy. */
  swapPanelsInDocking: (id1: PanelId, id2: PanelId) => void;
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
  // Lazy initializer + key propia, mismo criterio que initialPanelsState.
  const [dockingLayout, setDockingLayout] = useState<DockingLayout>(getInitialDockingLayout);

  const setZoneVisible = (zone: keyof LayoutZones, visible: boolean) => {
    setZones((prev) => ({ ...prev, [zone]: visible }));
  };

  const toggleZone = (zone: keyof LayoutZones) => {
    setZones((prev) => ({ ...prev, [zone]: !prev[zone] }));
  };

  const updateDockingLayout = (updates: Partial<DockingLayout>) => {
    setDockingLayout((prev) => ({ ...prev, ...updates }));
  };

  // Etapa 4c-1. Lee `dockingLayout` del closure de render (no un
  // functional updater) - mismo criterio que bringToFront ya usa para
  // `maxZ` más abajo: estas acciones siempre las dispara un evento
  // discreto del usuario (click de toolbar, no un loop de alta
  // frecuencia como pointermove), así que no hay carrera real que un
  // updater funcional tendría que resolver.
  const addPanelToDocking = (id: PanelId, preferSlot?: DockingSlot): boolean => {
    let targetSlot = preferSlot;
    if (!targetSlot) {
      if (dockingLayout.leftColumn.length < 2) targetSlot = dockingLayout.leftColumn.length === 0 ? "left-top" : "left-bottom";
      else if (dockingLayout.rightColumn.length < 2) targetSlot = dockingLayout.rightColumn.length === 0 ? "right-top" : "right-bottom";
      else return false; // grid lleno (4/4) - el caller decide el fallback (togglePanel: abre libre)
    }

    const isLeft = targetSlot.startsWith("left");
    const newLayout = recalculateDockingHeights({
      ...dockingLayout,
      leftColumn: isLeft ? [...dockingLayout.leftColumn, id] : dockingLayout.leftColumn,
      rightColumn: isLeft ? dockingLayout.rightColumn : [...dockingLayout.rightColumn, id],
    });
    setDockingLayout(newLayout);
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], open: true, mode: "docked", dockSlot: targetSlot } }));
    return true;
  };

  const removePanelFromDocking = (id: PanelId) => {
    const newLayout = recalculateDockingHeights({
      ...dockingLayout,
      leftColumn: dockingLayout.leftColumn.filter((p) => p !== id),
      rightColumn: dockingLayout.rightColumn.filter((p) => p !== id),
    });
    setDockingLayout(newLayout);
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], open: false, mode: "docked", dockSlot: null } }));
  };

  // Etapa 4c-1: definida, no wireada a ninguna UI todavía (ver el
  // comentario en LayoutStateContextType) - Etapa 4c-2 le agrega drag-
  // to-swap real sobre DockingContainer.
  const swapPanelsInDocking = (id1: PanelId, id2: PanelId) => {
    const { leftColumn, rightColumn } = dockingLayout;
    const idx1Left = leftColumn.indexOf(id1);
    const idx1Right = rightColumn.indexOf(id1);
    const idx2Left = leftColumn.indexOf(id2);
    const idx2Right = rightColumn.indexOf(id2);

    let newLeftColumn = leftColumn;
    let newRightColumn = rightColumn;
    let slot1: DockingSlot | undefined;
    let slot2: DockingSlot | undefined;

    if (idx1Left >= 0 && idx2Right >= 0) {
      newLeftColumn = leftColumn.map((p, i) => (i === idx1Left ? id2 : p));
      newRightColumn = rightColumn.map((p, i) => (i === idx2Right ? id1 : p));
      slot1 = idx2Right === 0 ? "right-top" : "right-bottom";
      slot2 = idx1Left === 0 ? "left-top" : "left-bottom";
    } else if (idx1Right >= 0 && idx2Left >= 0) {
      newRightColumn = rightColumn.map((p, i) => (i === idx1Right ? id2 : p));
      newLeftColumn = leftColumn.map((p, i) => (i === idx2Left ? id1 : p));
      slot1 = idx2Left === 0 ? "left-top" : "left-bottom";
      slot2 = idx1Right === 0 ? "right-top" : "right-bottom";
    } else if (idx1Left >= 0 && idx2Left >= 0) {
      newLeftColumn = leftColumn.map((p, i) => (i === idx1Left ? id2 : i === idx2Left ? id1 : p));
      slot1 = idx2Left === 0 ? "left-top" : "left-bottom";
      slot2 = idx1Left === 0 ? "left-top" : "left-bottom";
    } else if (idx1Right >= 0 && idx2Right >= 0) {
      newRightColumn = rightColumn.map((p, i) => (i === idx1Right ? id2 : i === idx2Right ? id1 : p));
      slot1 = idx2Right === 0 ? "right-top" : "right-bottom";
      slot2 = idx1Right === 0 ? "right-top" : "right-bottom";
    } else {
      return; // uno de los dos no está docked - nada que intercambiar
    }

    setDockingLayout((prev) => ({ ...prev, leftColumn: newLeftColumn, rightColumn: newRightColumn }));
    setPanels((prev) => ({
      ...prev,
      [id1]: { ...prev[id1], dockSlot: slot1 ?? prev[id1].dockSlot },
      [id2]: { ...prev[id2], dockSlot: slot2 ?? prev[id2].dockSlot },
    }));
  };

  // Cerrar nunca recalcula posición LIBRE - solo apaga `open`,
  // conservando x/y/width/height/zIndex tal como estaban (relevante
  // desde Etapa 4b-2). Si el panel estaba docked, cerrar SÍ dispara
  // reflow (removePanelFromDocking recalcula heights de la columna que
  // pierde un elemento). Abrir: Etapa 4c-1 lo dockea por default si el
  // grid tiene lugar (<4); si está lleno, cae al mismo cálculo de
  // cascada libre que ya existía antes de esta fase - `openIndex` ahora
  // cuenta solo paneles LIBRES abiertos (los docked no participan de la
  // cascada, tienen su propia posición de grid).
  const togglePanel = (id: PanelId) => {
    const current = panels[id];
    if (current.open) {
      if (current.mode === "docked") {
        removePanelFromDocking(id);
      } else {
        setPanels((prev) => ({ ...prev, [id]: { ...prev[id], open: false } }));
      }
      return;
    }

    const totalDocked = dockingLayout.leftColumn.length + dockingLayout.rightColumn.length;
    if (totalDocked < 4 && addPanelToDocking(id)) return;

    setPanels((prev) => {
      const openFreeCountBefore = Object.values(prev).filter((p) => p.open && p.mode === "free").length;
      const nextMaxZ = maxZ + 1;
      setMaxZ(nextMaxZ);
      return { ...prev, [id]: calculateInitialPosition(openFreeCountBefore, nextMaxZ) };
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

  // Efecto separado, key separada (DOCKING_STORAGE_KEY) - mismo criterio
  // que los dos de arriba.
  useEffect(() => {
    savePersistedDockingLayout(dockingLayout);
  }, [dockingLayout]);

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
        dockingLayout,
        updateDockingLayout,
        addPanelToDocking,
        removePanelFromDocking,
        swapPanelsInDocking,
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
