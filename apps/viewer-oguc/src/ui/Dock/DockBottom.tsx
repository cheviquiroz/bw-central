// src/ui/Dock/DockBottom.tsx
//
// Full-width zone below the viewport (spans all three columns of
// .viewport's grid - see Layout.css), holding BcfPanel. Chosen over
// "between the side panels" because: (1) it's a simpler
// grid-template-areas than threading the bottom row between two
// independently-hideable columns, (2) it matches what Navisworks/Solibri
// actually do (full width, not squeezed between side docks), and (3)
// squeezing it between side panels would undercut the entire reason this
// moved out of the right dock - the extra width is the point.
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  useLayoutState,
  MIN_BOTTOM_DOCK_HEIGHT,
  MAX_BOTTOM_DOCK_HEIGHT_VH,
} from "../LayoutStateContext";
import { BcfPanel } from "../BcfPanel/BcfPanel";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import type { ModuleRuntimeMap } from "../registry/modules";
import "./dock-bottom.css";

interface DockBottomProps {
  bcfState: BcfManagerState;
  onBcfFilterChange: (status: BcfFilterStatus) => void;
  onBcfTopicSelect: (topic: BcfTopic | null) => void;
  onBcfTopicActivate: (topic: BcfTopic) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
}

export function DockBottom({
  bcfState,
  onBcfFilterChange,
  onBcfTopicSelect,
  onBcfTopicActivate,
  moduleRuntime,
  hasModel,
}: DockBottomProps) {
  const { zones, setZoneVisible, bottomDockHeight, setBottomDockHeight } = useLayoutState();
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Drag-based resize (grab the top edge), not hover - consistent with
  // the rest of this task's "zero hover-driven behavior" constraint. The
  // handle only reacts to an active pointer drag; hovering it does
  // nothing but show a resize cursor (CSS-only, informational).
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = { startY: event.clientY, startHeight: bottomDockHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    // Arrastrar hacia arriba (deltaY negativo) agranda el dock - por eso
    // la resta está invertida respecto al signo de deltaY.
    const deltaY = event.clientY - drag.startY;
    const maxHeight = window.innerHeight * MAX_BOTTOM_DOCK_HEIGHT_VH;
    const nextHeight = Math.min(maxHeight, Math.max(MIN_BOTTOM_DOCK_HEIGHT, drag.startHeight - deltaY));
    setBottomDockHeight(nextHeight);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!zones.bottom) return null;

  return (
    <div className="dock-bottom" style={{ height: `${bottomDockHeight}px` }}>
      <div
        className="dock-bottom-resize-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <BcfPanel
        state={bcfState}
        onFilterChange={onBcfFilterChange}
        onTopicSelect={onBcfTopicSelect}
        onTopicActivate={onBcfTopicActivate}
        moduleRuntime={moduleRuntime}
        hasModel={hasModel}
        onClose={() => setZoneVisible("bottom", false)}
      />
    </div>
  );
}
