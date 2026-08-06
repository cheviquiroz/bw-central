// src/ui/Dock/DockRight.tsx
//
// Replaces DockRightWithTabs (Fase 3 de "WORKSPACE LAYOUT"): Incidencias
// moved to DockBottom.tsx (BCF issue lists are tabular - id/title/status/
// assignee/date/priority + thumbnail - and need horizontal width a 272px
// column can't give). This dock now holds only PropertiesPanel, so the
// tab bar that used to switch between "Datos"/"Incidencias" is gone -
// there is nothing left to switch between.
import { useLayoutState } from "../LayoutStateContext";
import PropertiesPanel from "../../components/PropertiesPanel/PropertiesPanel";
import "./dock-right.css";

export function DockRight() {
  const { zones } = useLayoutState();

  if (!zones.right) return null;

  return (
    <div className="dock-right">
      <PropertiesPanel />
    </div>
  );
}
