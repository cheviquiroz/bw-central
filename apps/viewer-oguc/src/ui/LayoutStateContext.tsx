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

  const setZoneVisible = (zone: keyof LayoutZones, visible: boolean) => {
    setZones((prev) => ({ ...prev, [zone]: visible }));
  };

  const toggleZone = (zone: keyof LayoutZones) => {
    setZones((prev) => ({ ...prev, [zone]: !prev[zone] }));
  };

  // Escribe en cada cambio, no solo al desmontar - esta app nunca se
  // desmonta en uso normal (es la app entera), así que "guardar al salir"
  // significaría, en la práctica, nunca guardar nada.
  useEffect(() => {
    savePersistedLayout({ zones, propertiesTab, bottomDockHeight, leftWidth, rightWidth });
  }, [zones, propertiesTab, bottomDockHeight, leftWidth, rightWidth]);

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
