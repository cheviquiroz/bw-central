// src/ui/Dock/DockRight.tsx
//
// Replaces DockRightWithTabs (Fase 3 de "WORKSPACE LAYOUT"): Incidencias
// moved to DockBottom.tsx (BCF issue lists are tabular - id/title/status/
// assignee/date/priority + thumbnail - and need horizontal width a 272px
// column can't give). This dock now holds only PropertiesPanel, so the
// tab bar that used to switch between "Datos"/"Incidencias" is gone -
// there is nothing left to switch between.
import { useLayoutState, CANVAS_MIN_WIDTH, MIN_SIDE_DOCK_WIDTH, TOOLBAR_GAP, DOCK_TOP_OFFSET } from "../LayoutStateContext";
import { ResizeHandle } from "../ResizeHandle";
import PropertiesPanel from "../../components/PropertiesPanel/PropertiesPanel";
import "./dock-right.css";

// Ver el comentario equivalente en DockLeft.tsx (Etapa 4a Fase 2) - ya
// no hay padding de .viewport ni margin-left propio que restar, solo el
// inset de TOOLBAR_GAP de este dock (y del otro lateral, si está
// montado).
const GUTTER_PX = TOOLBAR_GAP;

interface DockRightProps {
  /** Mismo gate que ya usa DockLeft.tsx (zones.left/hasModel) - sin esto, este panel mostraba "Ningún elemento seleccionado" antes de cargar cualquier modelo, la única diferencia real (no cosmética) entre el empty state y lo esperado. */
  hasModel: boolean;
}

export function DockRight({ hasModel }: DockRightProps) {
  const { zones, leftWidth, rightWidth, setRightWidth, bottomDockHeight } = useLayoutState();

  if (!zones.right || !hasModel) return null;

  // Ver el comentario equivalente en DockLeft.tsx - mismo cálculo,
  // espejado: acá se resta el ancho (+ gutter, si está montado) de
  // DockLeft en vez del de DockRight.
  const leftOverhead = zones.left ? leftWidth + GUTTER_PX : 0;
  const maxWidth = Math.max(MIN_SIDE_DOCK_WIDTH, window.innerWidth - GUTTER_PX - leftOverhead - CANVAS_MIN_WIDTH);

  // Etapa 4a Fase 2 (Opción A) - ver el comentario equivalente en
  // DockLeft.tsx, mismo cálculo exacto (ambos docks laterales comparten
  // el mismo `top` y se acortan igual cuando DockBottom está abierto).
  const topOffset = DOCK_TOP_OFFSET;
  const bottomReserved = zones.bottom ? bottomDockHeight + TOOLBAR_GAP : TOOLBAR_GAP;
  const height = window.innerHeight - topOffset - bottomReserved;

  return (
    <div className="dock-right" style={{ width: `${rightWidth}px`, height: `${height}px` }}>
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
