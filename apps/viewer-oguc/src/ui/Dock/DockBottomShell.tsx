// src/ui/Dock/DockBottomShell.tsx
//
// Chrome shared by every bottom-dock content type: visibility (zones.bottom),
// height (bottomDockHeight, LayoutStateContext), and the drag-based resize
// handle on the top edge. Extracted out of DockBottom.tsx (which was BCF-only)
// so /revision's findings dock can reuse the exact same shell instead of
// duplicating the resize math - only the CONTENT differs between "/" (BcfPanel)
// and "/revision" (a findings placeholder today, the real findings list later).
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  useLayoutState,
  MIN_BOTTOM_DOCK_HEIGHT,
  MAX_BOTTOM_DOCK_HEIGHT_VH,
} from "../LayoutStateContext";
import "./dock-bottom.css";

export function DockBottomShell({ children }: { children: ReactNode }) {
  const { zones, bottomDockHeight, setBottomDockHeight } = useLayoutState();
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Drag-based resize (grab the top edge), not hover - consistent with
  // this app's "zero hover-driven behavior" constraint. The handle only
  // reacts to an active pointer drag; hovering it does nothing but show
  // a resize cursor (CSS-only, informational).
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
      {children}
    </div>
  );
}
