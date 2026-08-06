// src/ui/Dock/DockRightWithTabs.tsx
//
// No collapsed-rail state: either mounted at full width (visible) or not
// mounted at all (zones.right === false). isRightDockOpen (Context) is
// now zones.right (LayoutStateContext) - shared between the two tabs for
// the same reason as before: they're the same panel, so hiding/showing
// must not depend on which tab happens to be active.
import { useState } from "react";
import { useLayoutState } from "../LayoutStateContext";
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
  const { zones, setZoneVisible } = useLayoutState();

  // El tab-bar es el punto de entrada de este dock: clickear una tab
  // siempre cambia a esa tab Y muestra el panel si estaba oculto.
  const handleTabClick = (tab: RightTab) => {
    setActiveTab(tab);
    setZoneVisible("right", true);
  };

  if (!zones.right) return null;

  return (
    <div className="dock-right-tabs">
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
