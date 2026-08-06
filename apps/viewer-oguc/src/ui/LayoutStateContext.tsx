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
// sesión sin nada persistido depende del ancho de pantalla.
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
// se recalcula en el propio handler de resize (ver DockBottom.tsx), este
// valor solo documenta la regla.
export const MAX_BOTTOM_DOCK_HEIGHT_VH = 0.6;

const DEFAULT_PROPERTIES_TAB: PropertiesTab = "PROPERTIES";

// Fase 5b: lo persistido (si existe y tiene un shape válido - ver
// layoutPersistence.ts) gana sobre los defaults calculados; el heurístico
// de pantalla angosta de getDefaultZones() solo aplica quien nunca guardó
// nada antes (primera visita real, o localStorage corrupto/vaciado).
function getInitialLayout() {
  const persisted = loadPersistedLayout();
  if (persisted) return persisted;
  return { zones: getDefaultZones(), propertiesTab: DEFAULT_PROPERTIES_TAB, bottomDockHeight: DEFAULT_BOTTOM_DOCK_HEIGHT };
}

interface LayoutStateContextType {
  zones: LayoutZones;
  setZoneVisible: (zone: keyof LayoutZones, visible: boolean) => void;
  toggleZone: (zone: keyof LayoutZones) => void;
  bottomDockHeight: number;
  setBottomDockHeight: (height: number) => void;
  propertiesTab: PropertiesTab;
  setPropertiesTab: (tab: PropertiesTab) => void;
}

const LayoutStateContext = createContext<LayoutStateContextType | undefined>(undefined);

export function LayoutStateProvider({ children }: { children: ReactNode }) {
  // useState(getInitialLayout) sin llamarlo - lazy initializer, corre una
  // sola vez al montar, no en cada render. Los 3 campos parten del MISMO
  // objeto leído/calculado una vez (no 3 lecturas independientes de
  // localStorage) para que un layout persistido parcialmente corrupto no
  // pueda mezclar, por accidente, zones de una versión con
  // bottomDockHeight de otra.
  const [initialLayout] = useState(getInitialLayout);
  const [zones, setZones] = useState<LayoutZones>(initialLayout.zones);
  const [bottomDockHeight, setBottomDockHeight] = useState<number>(initialLayout.bottomDockHeight);
  const [propertiesTab, setPropertiesTab] = useState<PropertiesTab>(initialLayout.propertiesTab);

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
    savePersistedLayout({ zones, propertiesTab, bottomDockHeight });
  }, [zones, propertiesTab, bottomDockHeight]);

  return (
    <LayoutStateContext.Provider
      value={{ zones, setZoneVisible, toggleZone, bottomDockHeight, setBottomDockHeight, propertiesTab, setPropertiesTab }}
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
