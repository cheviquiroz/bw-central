// src/ui/Dock/DockRightWithTabs.tsx
//
// Reemplaza el par PropertiesPanel/BcfPanel flotando uno al lado del otro
// (ambos anclados a right:16px, con BcfPanel calculando su propio "right"
// en función del ancho de PropertiesPanel para no superponerse) por UN
// solo slot con tabs. Nunca hay dos paneles compitiendo por el mismo
// espacio: solo uno está montado a la vez.
//
// PropertiesPanel/BcfPanel ya no tienen proximity-hover ni isPinned local
// (ver el commit que remueve el hover-proximity de los 3 paneles
// laterales) - abrir/cerrar es un solo booleano compartido
// (isRightDockOpen en PanelWidthContext, no un useState local a cada
// tab), justamente porque las dos tabs son el MISMO panel: si estaba
// abierto en "Datos" y cambiás a "Incidencias", debe seguir abierto.
import { useState } from "react";
import type { CSSProperties } from "react";
import { usePanelWidth } from "../PanelWidthContext";
import PropertiesPanel from "../../components/PropertiesPanel/PropertiesPanel";
import { BcfPanel } from "../BcfPanel/BcfPanel";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import type { ModuleRuntimeMap } from "../registry/modules";
import "./dock-right-tabs.css";

type RightTab = "properties" | "bcf";

interface DockRightWithTabsProps {
  bcfState: BcfManagerState;
  onBcfFilterChange: (status: BcfFilterStatus) => void;
  onBcfTopicSelect: (topic: BcfTopic | null) => void;
  onBcfTopicActivate: (topic: BcfTopic) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
}

export function DockRightWithTabs({
  bcfState,
  onBcfFilterChange,
  onBcfTopicSelect,
  onBcfTopicActivate,
  moduleRuntime,
  hasModel,
}: DockRightWithTabsProps) {
  const [activeTab, setActiveTab] = useState<RightTab>("properties");
  // Cada tab publica su PROPIO ancho (panelWidth/bcfPanelWidth siguen
  // siendo dos valores de Context separados, sin cambios ahí - ver
  // PanelWidthContext.tsx) - se lee el del tab activo, no ambos, porque
  // solo uno está realmente visible en cada momento.
  const { panelWidth, bcfPanelWidth, setIsRightDockOpen } = usePanelWidth();
  const width = activeTab === "properties" ? panelWidth : bcfPanelWidth;

  // El tab-bar es el "riel colapsado" clickeable de este dock (equivalente
  // a DockCollapsed en DockLeft): clickear una tab siempre cambia a esa
  // tab Y abre el panel si estaba cerrado - un solo click alcanza para
  // "quiero ver Incidencias", sin necesitar abrir primero y cambiar de tab
  // después.
  const handleTabClick = (tab: RightTab) => {
    setActiveTab(tab);
    setIsRightDockOpen(true);
  };

  return (
    <div className="dock-right-tabs" style={{ "--dock-right-width": `${width}px` } as CSSProperties}>
      <div className="dock-right-tab-bar">
        <button
          className={`dock-right-tab${activeTab === "properties" ? " active" : ""}`}
          onClick={() => handleTabClick("properties")}
        >
          Datos
        </button>
        <button
          className={`dock-right-tab${activeTab === "bcf" ? " active" : ""}`}
          onClick={() => handleTabClick("bcf")}
        >
          Incidencias
        </button>
      </div>
      <div className="dock-right-tab-content">
        {activeTab === "properties" && <PropertiesPanel />}
        {activeTab === "bcf" && (
          <BcfPanel
            state={bcfState}
            onFilterChange={onBcfFilterChange}
            onTopicSelect={onBcfTopicSelect}
            onTopicActivate={onBcfTopicActivate}
            moduleRuntime={moduleRuntime}
            hasModel={hasModel}
          />
        )}
      </div>
    </div>
  );
}
