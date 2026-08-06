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
// hidden isn't a panel, it's a dialog nobody summoned). bottom starts
// false because DockBottom does not exist yet as of this file's own
// commit (see Phase 3) - once it does, its own default gets decided
// there, not silently inherited from this shape.
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export interface LayoutZones {
  left: boolean;
  right: boolean;
  bottom: boolean;
}

export const DEFAULT_LAYOUT_ZONES: LayoutZones = { left: true, right: true, bottom: false };

/**
 * Which tab is active inside the right dock. Lives here (not local state
 * in DockRightWithTabs) for two reasons: the Phase 2 workspace toggles
 * ("Datos" / "Incidencias") need to switch tabs from the Toolbar, outside
 * DockRightWithTabs's own subtree, and Phase 5b persists this exact value
 * to localStorage alongside zone visibility. Provisional until Phase 3
 * gives Incidencias its own DockBottom zone instead of sharing "right".
 */
export type RightTab = "properties" | "bcf";

interface LayoutStateContextType {
  zones: LayoutZones;
  setZoneVisible: (zone: keyof LayoutZones, visible: boolean) => void;
  toggleZone: (zone: keyof LayoutZones) => void;
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
}

const LayoutStateContext = createContext<LayoutStateContextType | undefined>(undefined);

export function LayoutStateProvider({ children }: { children: ReactNode }) {
  const [zones, setZones] = useState<LayoutZones>(DEFAULT_LAYOUT_ZONES);
  const [rightTab, setRightTab] = useState<RightTab>("properties");

  const setZoneVisible = (zone: keyof LayoutZones, visible: boolean) => {
    setZones((prev) => ({ ...prev, [zone]: visible }));
  };

  const toggleZone = (zone: keyof LayoutZones) => {
    setZones((prev) => ({ ...prev, [zone]: !prev[zone] }));
  };

  return (
    <LayoutStateContext.Provider value={{ zones, setZoneVisible, toggleZone, rightTab, setRightTab }}>
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
