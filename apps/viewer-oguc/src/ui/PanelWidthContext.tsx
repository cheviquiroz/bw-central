// src/ui/PanelWidthContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface PanelWidthContextType {
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  // BcfPanel se agrega en la misma esquina que PropertiesPanel (right:16px
  // los dos) - sin esto quedarían dibujados exactamente uno encima del
  // otro. BcfPanel publica acá su propio ancho para que OrientationCube
  // pueda correrse lo suficiente a la izquierda de AMBOS paneles, y
  // BcfPanel a su vez lee panelWidth (el de Properties) para saber dónde
  // empieza su propio hueco disponible - ver BcfPanel.tsx/OrientationCube.tsx.
  bcfPanelWidth: number;
  setBcfPanelWidth: (width: number) => void;
  /**
   * Abierto/cerrado del dock izquierdo (DockLeft) - antes vivía como
   * isPinned local a DockLeft, más una interpolación de ancho por
   * proximity-hover que ya no existe (ver el commit que remueve el
   * proximity-hover de los 3 paneles laterales). Ahora es binario y una
   * sola fuente de verdad.
   */
  isLeftDockOpen: boolean;
  setIsLeftDockOpen: (open: boolean) => void;
  /**
   * Abierto/cerrado del dock derecho (DockRightWithTabs). Deliberadamente
   * COMPARTIDO entre PropertiesPanel y BcfPanel, no un isPinned local a
   * cada uno como eran antes: son dos tabs del MISMO panel desde la Fase
   * 3, así que si estaba abierto en la tab "Datos" y el usuario cambia a
   * "Incidencias", debe seguir abierto - un estado local a cada
   * componente se resetearía solo al desmontarse/montarse en cada cambio
   * de tab, que es exactamente el comportamiento confuso que este cambio
   * existe para eliminar.
   */
  isRightDockOpen: boolean;
  setIsRightDockOpen: (open: boolean) => void;
}

const PanelWidthContext = createContext<PanelWidthContextType | undefined>(undefined);

export function PanelWidthProvider({ children }: { children: ReactNode }) {
  const [panelWidth, setPanelWidth] = useState(56); // Inicial: collapsed
  const [bcfPanelWidth, setBcfPanelWidth] = useState(56); // Inicial: collapsed
  const [isLeftDockOpen, setIsLeftDockOpen] = useState(false);
  const [isRightDockOpen, setIsRightDockOpen] = useState(false);

  return (
    <PanelWidthContext.Provider
      value={{
        panelWidth,
        setPanelWidth,
        bcfPanelWidth,
        setBcfPanelWidth,
        isLeftDockOpen,
        setIsLeftDockOpen,
        isRightDockOpen,
        setIsRightDockOpen,
      }}
    >
      {children}
    </PanelWidthContext.Provider>
  );
}

export function usePanelWidth() {
  const context = useContext(PanelWidthContext);
  if (!context) {
    throw new Error("usePanelWidth debe usarse dentro de PanelWidthProvider");
  }
  return context;
}
