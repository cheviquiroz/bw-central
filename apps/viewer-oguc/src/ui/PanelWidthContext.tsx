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
}

const PanelWidthContext = createContext<PanelWidthContextType | undefined>(undefined);

export function PanelWidthProvider({ children }: { children: ReactNode }) {
  const [panelWidth, setPanelWidth] = useState(56); // Inicial: collapsed
  const [bcfPanelWidth, setBcfPanelWidth] = useState(56); // Inicial: collapsed

  return (
    <PanelWidthContext.Provider value={{ panelWidth, setPanelWidth, bcfPanelWidth, setBcfPanelWidth }}>
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
