// src/ui/Dock/DockRight.tsx
//
// Replaces DockRightWithTabs (Fase 3 de "WORKSPACE LAYOUT"): Incidencias
// moved to DockBottom.tsx (BCF issue lists are tabular - id/title/status/
// assignee/date/priority + thumbnail - and need horizontal width a 272px
// column can't give). This dock now holds only PropertiesPanel, so the
// tab bar that used to switch between "Datos"/"Incidencias" is gone -
// there is nothing left to switch between.
import { useLayoutState, CANVAS_MIN_WIDTH, MIN_SIDE_DOCK_WIDTH } from "../LayoutStateContext";
import { ResizeHandle } from "../ResizeHandle";
import PropertiesPanel from "../../components/PropertiesPanel/PropertiesPanel";
import "./dock-right.css";

const OUTER_PADDING_PX = 32;
const GUTTER_PX = 16;

export function DockRight() {
  const { zones, leftWidth, rightWidth, setRightWidth } = useLayoutState();

  if (!zones.right) return null;

  // Ver el comentario equivalente en DockLeft.tsx - mismo cálculo,
  // espejado: acá se resta el ancho (+ gutter, si está montado) de
  // DockLeft en vez del de DockRight.
  const leftOverhead = zones.left ? leftWidth + GUTTER_PX : 0;
  const maxWidth = Math.max(MIN_SIDE_DOCK_WIDTH, window.innerWidth - OUTER_PADDING_PX - GUTTER_PX - leftOverhead - CANVAS_MIN_WIDTH);

  return (
    <div className="dock-right" style={{ width: `${rightWidth}px` }}>
      <ResizeHandle
        direction="horizontal"
        side="right"
        currentSize={rightWidth}
        minSize={MIN_SIDE_DOCK_WIDTH}
        maxSize={maxWidth}
        onResize={setRightWidth}
        className="dock-right-resize-handle"
      />
      <PropertiesPanel />
    </div>
  );
}
