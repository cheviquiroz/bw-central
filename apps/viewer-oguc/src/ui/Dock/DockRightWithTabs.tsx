// src/ui/Dock/DockRightWithTabs.tsx
//
// Reemplaza el par PropertiesPanel/BcfPanel flotando uno al lado del otro
// (ambos anclados a right:16px, con BcfPanel calculando su propio "right"
// en función del ancho de PropertiesPanel para no superponerse) por UN
// solo slot con tabs. Nunca hay dos paneles compitiendo por el mismo
// espacio: solo uno está montado a la vez.
//
// PropertiesPanel/BcfPanel no cambiaron de lógica interna (proximity-hover,
// pin, tabs propios de PropertiesPanel) - solo dejaron de posicionarse a sí
// mismos (ver properties.css/bcf-panel.css) porque ahora ya no hacen falta:
// esta celda del grid de 3 columnas de .viewport (Layout.css) es quien les
// da su lugar.
import { useState } from "react";
import type { CSSProperties } from "react";
import { usePanelWidth } from "../PanelWidthContext";
import PropertiesPanel from "../../components/PropertiesPanel/PropertiesPanel";
import { BcfPanel } from "../BcfPanel/BcfPanel";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import "./dock-right-tabs.css";

type RightTab = "properties" | "bcf";

interface DockRightWithTabsProps {
  bcfState: BcfManagerState;
  onBcfFilterChange: (status: BcfFilterStatus) => void;
  onBcfTopicSelect: (topic: BcfTopic | null) => void;
  onBcfTopicActivate: (topic: BcfTopic) => void;
}

export function DockRightWithTabs({ bcfState, onBcfFilterChange, onBcfTopicSelect, onBcfTopicActivate }: DockRightWithTabsProps) {
  const [activeTab, setActiveTab] = useState<RightTab>("properties");
  // Cada tab publica su PROPIO ancho (panelWidth/bcfPanelWidth siguen
  // siendo dos valores de Context separados, sin cambios ahí - ver
  // PanelWidthContext.tsx) - se lee el del tab activo, no ambos, porque
  // solo uno está realmente visible en cada momento.
  const { panelWidth, bcfPanelWidth } = usePanelWidth();
  const width = activeTab === "properties" ? panelWidth : bcfPanelWidth;

  return (
    <div className="dock-right-tabs" style={{ "--dock-right-width": `${width}px` } as CSSProperties}>
      <div className="dock-right-tab-bar">
        <button
          className={`dock-right-tab${activeTab === "properties" ? " active" : ""}`}
          onClick={() => setActiveTab("properties")}
        >
          Datos
        </button>
        <button
          className={`dock-right-tab${activeTab === "bcf" ? " active" : ""}`}
          onClick={() => setActiveTab("bcf")}
        >
          Incidencias
        </button>
      </div>
      <div className="dock-right-tab-content">
        {activeTab === "properties" && <PropertiesPanel />}
        {activeTab === "bcf" && (
          <BcfPanel state={bcfState} onFilterChange={onBcfFilterChange} onTopicSelect={onBcfTopicSelect} onTopicActivate={onBcfTopicActivate} />
        )}
      </div>
    </div>
  );
}
